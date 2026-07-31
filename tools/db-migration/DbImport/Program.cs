using System.Data;
using System.Globalization;
using System.Text.Json;
using Microsoft.Data.SqlClient;

// Loads the JSON produced by export_sqlite.py + filter_export.py into the SQL Server
// databases the services have already migrated into being.
//
// Run AFTER the services have started once, so EF has created the schema. This only
// moves rows; it never issues DDL.
//
// Connection strings are read from each service's own appsettings.json rather than
// duplicated here, so there is exactly one place where the server name lives.

var exportPath = args.FirstOrDefault() ?? "sqlite-export.filtered.json";
var repoRoot = FindRepoRoot();
var servicesDir = Path.Combine(repoRoot, "src", "Backend", "Services");

if (!Path.IsPathRooted(exportPath))
    exportPath = Path.Combine(repoRoot, "tools", "db-migration", exportPath);

if (!File.Exists(exportPath))
{
    Console.Error.WriteLine($"export not found: {exportPath}");
    return 1;
}

using var doc = JsonDocument.Parse(File.ReadAllText(exportPath));
var databases = doc.RootElement.GetProperty("databases");

var grandTotal = 0;
var failures = new List<string>();

foreach (var db in databases.EnumerateObject())
{
    var service = db.Name;
    var connectionString = ReadConnectionString(servicesDir, service);
    Console.WriteLine($"######## {service} ########");

    try
    {
        grandTotal += ImportService(connectionString, db.Value);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"  FAILED: {ex.Message}");
        failures.Add($"{service}: {ex.Message}");
    }

    Console.WriteLine();
}

Console.WriteLine($"{grandTotal} rows imported across {databases.EnumerateObject().Count()} databases");
if (failures.Count > 0)
{
    Console.WriteLine($"\n{failures.Count} FAILURE(S):");
    foreach (var f in failures) Console.WriteLine("  " + f);
    return 1;
}
return 0;


static int ImportService(string connectionString, JsonElement tables)
{
    using var conn = new SqlConnection(connectionString);
    conn.Open();

    var present = ExistingTables(conn);
    var toLoad = tables.EnumerateObject()
        .Where(t => t.Value.GetProperty("rows").GetArrayLength() > 0)
        .ToList();

    // Constraints come off for the load so table order does not matter, then go back on
    // WITH CHECK — which re-validates every row. If the filtered data had introduced a
    // broken reference, that re-enable is what fails, rather than something noticing later.
    foreach (var t in present) Exec(conn, $"ALTER TABLE [{t}] NOCHECK CONSTRAINT ALL");

    var total = 0;
    try
    {
        // Clear first so a re-run is idempotent rather than duplicating everything.
        foreach (var t in present) Exec(conn, $"DELETE FROM [{t}]");

        foreach (var table in toLoad)
        {
            if (!present.Contains(table.Name))
            {
                Console.WriteLine($"  {table.Name,-24} SKIPPED — no such table in SQL Server");
                continue;
            }

            var columnTypes = ColumnTypes(conn, table.Name);
            var rows = table.Value.GetProperty("rows");
            var n = 0;

            foreach (var row in rows.EnumerateArray())
            {
                var cols = row.EnumerateObject()
                    .Where(p => columnTypes.ContainsKey(p.Name))
                    .ToList();

                var names = string.Join(", ", cols.Select(c => $"[{c.Name}]"));
                var paras = string.Join(", ", cols.Select((_, i) => $"@p{i}"));

                using var cmd = new SqlCommand(
                    $"INSERT INTO [{table.Name}] ({names}) VALUES ({paras})", conn);

                for (var i = 0; i < cols.Count; i++)
                    cmd.Parameters.AddWithValue($"@p{i}",
                        Convert(cols[i].Value, columnTypes[cols[i].Name]) ?? DBNull.Value);

                cmd.ExecuteNonQuery();
                n++;
            }

            Console.WriteLine($"  {table.Name,-24} {n,4} rows");
            total += n;
        }
    }
    finally
    {
        foreach (var t in present) Exec(conn, $"ALTER TABLE [{t}] WITH CHECK CHECK CONSTRAINT ALL");
    }

    return total;
}


static object? Convert(JsonElement v, string sqlType)
{
    if (v.ValueKind == JsonValueKind.Null || v.ValueKind == JsonValueKind.Undefined)
        return null;

    // BLOBs were tagged by the exporter, since raw bytes are not JSON-safe.
    if (v.ValueKind == JsonValueKind.Object && v.TryGetProperty("__blob__", out var blob))
        return System.Convert.FromBase64String(blob.GetString()!);

    var text = v.ValueKind switch
    {
        JsonValueKind.String => v.GetString()!,
        JsonValueKind.True => "1",
        JsonValueKind.False => "0",
        _ => v.GetRawText(),
    };

    var inv = CultureInfo.InvariantCulture;
    return sqlType switch
    {
        "uniqueidentifier" => Guid.Parse(text),
        "datetime2" or "datetime" or "smalldatetime" or "date" =>
            DateTime.Parse(text, inv, DateTimeStyles.None),
        "datetimeoffset" => DateTimeOffset.Parse(text, inv),
        "time" => TimeSpan.Parse(text, inv),
        "bit" => text is "1" or "true" or "True",
        "tinyint" => byte.Parse(text, inv),
        "smallint" => short.Parse(text, inv),
        "int" => int.Parse(text, inv),
        "bigint" => long.Parse(text, inv),
        // decimal is parsed from its exact text, never via double — that round-trip is
        // precisely what storing money as TEXT in SQLite was protecting against.
        "decimal" or "numeric" or "money" or "smallmoney" => decimal.Parse(text, inv),
        "float" or "real" => double.Parse(text, inv),
        "varbinary" or "binary" or "image" => System.Convert.FromBase64String(text),
        _ => text,
    };
}


static HashSet<string> ExistingTables(SqlConnection conn)
{
    var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    using var cmd = new SqlCommand(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'", conn);
    using var r = cmd.ExecuteReader();
    while (r.Read()) set.Add(r.GetString(0));
    set.Remove("__EFMigrationsHistory");
    return set;
}


static Dictionary<string, string> ColumnTypes(SqlConnection conn, string table)
{
    var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    using var cmd = new SqlCommand(
        "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@t", conn);
    cmd.Parameters.AddWithValue("@t", table);
    using var r = cmd.ExecuteReader();
    while (r.Read()) map[r.GetString(0)] = r.GetString(1);
    return map;
}


static void Exec(SqlConnection conn, string sql)
{
    using var cmd = new SqlCommand(sql, conn);
    cmd.ExecuteNonQuery();
}


static string ReadConnectionString(string servicesDir, string service)
{
    var path = Path.Combine(servicesDir, service, "appsettings.json");
    using var d = JsonDocument.Parse(File.ReadAllText(path));
    return d.RootElement.GetProperty("ConnectionStrings").GetProperty("DefaultConnection").GetString()!;
}


static string FindRepoRoot()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null)
    {
        if (Directory.Exists(Path.Combine(dir.FullName, "src", "Backend", "Services")))
            return dir.FullName;
        dir = dir.Parent;
    }
    throw new DirectoryNotFoundException("could not locate repo root (src/Backend/Services)");
}
