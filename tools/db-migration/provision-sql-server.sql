/* ============================================================================
   Post Tender Management System — SQL Server provisioning
   ----------------------------------------------------------------------------
   Creates the 7 per-microservice databases and one application login scoped
   to exactly those databases. No cross-database access is granted or needed
   — each service already talks to its own database only, matching the
   existing microservice boundary (see tools/db-migration/README.md).

   BEFORE RUNNING:
     1. Change @AppPassword below to something meeting your server's
        password policy. Do not leave the placeholder in place.
     2. If this is Azure SQL Database (the PaaS "single database" product,
        not a VM or Managed Instance), STOP — this script will not work as
        written. Azure SQL Database has no CREATE LOGIN and no cross-database
        USE statements; contained database users have to be created by
        connecting to each database individually. Say so and a variant will
        be generated instead.

   Safe to re-run: every step checks for existing objects first, and
   re-adding an existing role member is a no-op in SQL Server rather than
   an error.

   Run as a login with sysadmin, or at minimum server permissions
   CREATE ANY DATABASE + ALTER ANY LOGIN.
   ============================================================================ */

SET NOCOUNT ON;

DECLARE @AppLogin    sysname       = N'posttender_app';
DECLARE @AppPassword nvarchar(128) = N'CHANGE-ME-Str0ng-P@ssw0rd!';

-- A single quote character, used to delimit string literals inside the dynamic
-- SQL built below. Nested '''''' quote-doubling is exactly the kind of thing
-- that's easy to miscount by eye and get subtly wrong; CHAR(39) + REPLACE makes
-- each literal's boundaries unambiguous instead of requiring a manual quote-count.
DECLARE @q char(1) = CHAR(39);

-- ----------------------------------------------------------------------------
-- 1. Server login
--    CHECK_EXPIRATION = OFF: this is a service account nobody will manually
--    rotate on a timer: an expiry would just take every service down at
--    once with no warning. CHECK_POLICY = ON still enforces complexity.
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @AppLogin)
BEGIN
    DECLARE @createLogin nvarchar(max) =
        N'CREATE LOGIN ' + QUOTENAME(@AppLogin) +
        N' WITH PASSWORD = N' + @q + REPLACE(@AppPassword, @q, @q + @q) + @q + N',
             CHECK_POLICY = ON,
             CHECK_EXPIRATION = OFF;';
    EXEC (@createLogin);
    PRINT 'Created login ' + @AppLogin;
END
ELSE
BEGIN
    PRINT 'Login ' + @AppLogin + ' already exists — leaving its password as-is.';
    PRINT '  (to reset it: ALTER LOGIN ' + QUOTENAME(@AppLogin) + ' WITH PASSWORD = N''...'';)';
END

-- ----------------------------------------------------------------------------
-- 1b. Mixed Mode check.
--     A SQL login is created above, but if the instance is in Windows-
--     Authentication-only mode (the SQL Server Express default) that login
--     physically cannot connect, and the app would fail at startup with a bare
--     "Login failed for user" that says nothing about the real cause. Detect it
--     here instead. Everything else in this script still applies either way.
-- ----------------------------------------------------------------------------
IF SERVERPROPERTY('IsIntegratedSecurityOnly') = 1
BEGIN
    PRINT '';
    PRINT '*** WARNING: this instance accepts WINDOWS AUTHENTICATION ONLY. ***';
    PRINT '    The login ' + @AppLogin + ' was created but cannot connect until Mixed Mode';
    PRINT '    is enabled. Either:';
    PRINT '      (a) enable Mixed Mode - SSMS > right-click server > Properties >';
    PRINT '          Security > "SQL Server and Windows Authentication mode",';
    PRINT '          then RESTART the SQL Server service; or';
    PRINT '      (b) skip the SQL login entirely and use Windows auth in the';
    PRINT '          connection strings: Trusted_Connection=True (drop User Id/Password),';
    PRINT '          granting the service account''s Windows login the same roles.';
    PRINT '';
END
ELSE
    PRINT 'Mixed Mode is enabled — the SQL login can connect.';

-- ----------------------------------------------------------------------------
-- 2. Databases + per-database user with the roles EF Core migrations need.
--    db_ddladmin lets the app create/alter tables when each service runs
--    Database.Migrate() on startup; db_datareader/db_datawriter cover its
--    own reads and writes. Not db_owner — there's no reason for the app
--    login to be able to drop the database it runs against or manage
--    other users' permissions in it.
-- ----------------------------------------------------------------------------
DECLARE @db sysname;
DECLARE @dbList TABLE (Name sysname);
INSERT INTO @dbList (Name) VALUES
    (N'PostTender_Identity'),
    (N'PostTender_Vendor'),
    (N'PostTender_Tender'),
    (N'PostTender_Execution'),
    (N'PostTender_Inspection'),
    (N'PostTender_Financial'),
    (N'PostTender_Common');

-- Declared out here rather than inside the loop: EXEC() accepts a concatenation
-- of literals and variables but NOT function calls, so QUOTENAME has to be
-- resolved into a variable first and the variable handed to EXEC.
DECLARE @createDb nvarchar(max);
DECLARE @grant    nvarchar(max);

DECLARE db_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT Name FROM @dbList;
OPEN db_cursor;
FETCH NEXT FROM db_cursor INTO @db;

WHILE @@FETCH_STATUS = 0
BEGIN
    IF DB_ID(@db) IS NULL
    BEGIN
        SET @createDb = N'CREATE DATABASE ' + QUOTENAME(@db) + N';';
        EXEC (@createDb);
        PRINT 'Created database ' + @db;
    END
    ELSE
        PRINT 'Database ' + @db + ' already exists — skipped';

    SET @grant =
        N'USE ' + QUOTENAME(@db) + N';
        IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N' + @q + @AppLogin + @q + N')
        BEGIN
            CREATE USER ' + QUOTENAME(@AppLogin) + N' FOR LOGIN ' + QUOTENAME(@AppLogin) + N';
        END
        ALTER ROLE db_ddladmin   ADD MEMBER ' + QUOTENAME(@AppLogin) + N';
        ALTER ROLE db_datareader ADD MEMBER ' + QUOTENAME(@AppLogin) + N';
        ALTER ROLE db_datawriter ADD MEMBER ' + QUOTENAME(@AppLogin) + N';';
    EXEC (@grant);
    PRINT '  granted ddladmin/datareader/datawriter on ' + @db + ' to ' + @AppLogin;

    FETCH NEXT FROM db_cursor INTO @db;
END

CLOSE db_cursor;
DEALLOCATE db_cursor;

PRINT '';
PRINT '========================================================================';
PRINT 'Done. Connection string shape for each service''s appsettings.json';
PRINT '(swap <host>,<port> and <the password you set above>; the Database=';
PRINT 'value changes per service — one of the 7 names created above):';
PRINT '';
PRINT '  Server=<host>,<port>;Database=PostTender_Identity;User Id=' + @AppLogin + ';Password=<password>;TrustServerCertificate=True;MultipleActiveResultSets=true';
PRINT '========================================================================';

/* ----------------------------------------------------------------------------
   Rollback (NOT executed — copy out and run by hand if you need to undo this).

   DROP LOGIN posttender_app;
   DROP DATABASE PostTender_Identity;
   DROP DATABASE PostTender_Vendor;
   DROP DATABASE PostTender_Tender;
   DROP DATABASE PostTender_Execution;
   DROP DATABASE PostTender_Inspection;
   DROP DATABASE PostTender_Financial;
   DROP DATABASE PostTender_Common;
---------------------------------------------------------------------------- */
