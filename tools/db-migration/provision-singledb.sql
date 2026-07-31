/* ============================================================================
   Post Tender Management System — SQL Server provisioning (SINGLE DATABASE)
   ----------------------------------------------------------------------------
   For the existing staging server, where all seven services share one catalog
   (PostTender_Staging) rather than one database each. The services keep their
   own DbContexts and never join across service boundaries; they simply happen
   to live in the same database. All 33 table names are globally unique across
   the seven services, which is what makes this safe — generate_complete_script.py
   asserts that rather than assuming it.

   Creates a login scoped to THIS DATABASE ONLY. Deliberately not sa: that
   account is sysadmin over every database on this shared instance (~45 of them,
   belonging to unrelated projects), so an application compromise would reach
   all of them. This login can touch exactly one.

   BEFORE RUNNING: set @AppPassword.

   *** DESTRUCTIVE ***
   Section 3 drops the pre-existing Post Tender tables so the schema can be
   rebuilt from the current model. Take a backup first:
       BACKUP DATABASE [PostTender_Staging] TO DISK = N'...\pre-migration.bak' WITH INIT;
   ============================================================================ */

SET NOCOUNT ON;
USE [PostTender_Staging];
GO

DECLARE @AppLogin    sysname       = N'posttender_app';
DECLARE @AppPassword nvarchar(128) = N'CHANGE-ME-Str0ng-P@ssw0rd!';
DECLARE @q char(1) = CHAR(39);

-- ----------------------------------------------------------------------------
-- 1. Server login (scoped to this database only via section 2)
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = @AppLogin)
BEGIN
    DECLARE @createLogin nvarchar(max) =
        N'CREATE LOGIN ' + QUOTENAME(@AppLogin) +
        N' WITH PASSWORD = N' + @q + REPLACE(@AppPassword, @q, @q + @q) + @q + N',
             CHECK_POLICY = ON,
             CHECK_EXPIRATION = OFF,
             DEFAULT_DATABASE = [PostTender_Staging];';
    EXEC (@createLogin);
    PRINT 'Created login ' + @AppLogin;
END
ELSE
    PRINT 'Login ' + @AppLogin + ' already exists — password left unchanged.';

IF SERVERPROPERTY('IsIntegratedSecurityOnly') = 1
    PRINT '*** WARNING: instance is Windows-auth only; this SQL login cannot connect. ***';
ELSE
    PRINT 'Mixed Mode is enabled — the SQL login can connect.';

-- ----------------------------------------------------------------------------
-- 2. Database user + roles.
--    db_ddladmin so EF's Database.Migrate() can create/alter its tables;
--    reader/writer for normal operation. NOT db_owner.
-- ----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'posttender_app')
    CREATE USER [posttender_app] FOR LOGIN [posttender_app];
ALTER ROLE db_ddladmin   ADD MEMBER [posttender_app];
ALTER ROLE db_datareader ADD MEMBER [posttender_app];
ALTER ROLE db_datawriter ADD MEMBER [posttender_app];
PRINT 'Granted ddladmin/datareader/datawriter on PostTender_Staging to posttender_app';
GO

-- ----------------------------------------------------------------------------
-- 3. *** DESTRUCTIVE *** Drop the previous Post Tender schema.
--
--    Only the tables listed below are dropped, and only if they exist. The list
--    is explicit rather than "drop every table in the database": an explicit list
--    cannot quietly grow to include something that was added later and matters.
--
--    Foreign keys are dropped first so table order does not matter.
-- ----------------------------------------------------------------------------
DECLARE @sql nvarchar(max) = N'';

SELECT @sql = @sql + N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id))
            + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
            + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';' + CHAR(10)
FROM sys.foreign_keys
WHERE OBJECT_NAME(parent_object_id) IN (
    'Departments','Users','Vendors','VendorCategories','Tenders','TenderTypes',
    'TenderAllotments','WorkOrders','Projects','TimeExtensions','Milestones',
    'MilestoneTemplates','MilestoneTemplateItem','MilestoneSubmissions',
    'MilestoneDocuments','ProgressReports','Queries','QueryMessages','QueryMessage',
    'Inspectors','Inspections','InspectionDefect','InspectionVisits','DefectCategories',
    'Bills','BillDeductions','BillPayments','BillingPolicies','TaxConfigurations',
    'Alerts','AlertReads','AuditLogs','ContractDocuments','Locations',
    'EvidenceFiles','ProjectAmendments','__EFMigrationsHistory');

IF LEN(@sql) > 0 EXEC sp_executesql @sql;
PRINT 'Dropped foreign keys on Post Tender tables';

SET @sql = N'';
SELECT @sql = @sql + N'DROP TABLE IF EXISTS ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';' + CHAR(10)
FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE t.name IN (
    'Departments','Users','Vendors','VendorCategories','Tenders','TenderTypes',
    'TenderAllotments','WorkOrders','Projects','TimeExtensions','Milestones',
    'MilestoneTemplates','MilestoneTemplateItem','MilestoneSubmissions',
    'MilestoneDocuments','ProgressReports','Queries','QueryMessages','QueryMessage',
    'Inspectors','Inspections','InspectionDefect','InspectionVisits','DefectCategories',
    'Bills','BillDeductions','BillPayments','BillingPolicies','TaxConfigurations',
    'Alerts','AlertReads','AuditLogs','ContractDocuments','Locations',
    'EvidenceFiles','ProjectAmendments','__EFMigrationsHistory');

IF LEN(@sql) > 0 EXEC sp_executesql @sql;
PRINT 'Dropped previous Post Tender tables — schema will be rebuilt from the current model';
GO
