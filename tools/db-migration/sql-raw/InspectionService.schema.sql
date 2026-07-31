IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202306_InitialSqlServer'
)
BEGIN
    CREATE TABLE [DefectCategories] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_DefectCategories] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202306_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Inspections] (
        [Id] uniqueidentifier NOT NULL,
        [ProjectId] uniqueidentifier NOT NULL,
        [VendorId] uniqueidentifier NOT NULL,
        [InspectorId] uniqueidentifier NOT NULL,
        [InspectionDate] datetime2 NOT NULL,
        [Remarks] nvarchar(max) NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [EvidenceUrl] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_Inspections] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202306_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Inspectors] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Email] nvarchar(max) NOT NULL,
        [Mobile] nvarchar(max) NOT NULL,
        [UserId] uniqueidentifier NULL,
        [Type] nvarchar(max) NOT NULL,
        [CompanyName] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Inspectors] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202306_InitialSqlServer'
)
BEGIN
    CREATE TABLE [InspectionDefect] (
        [Id] uniqueidentifier NOT NULL,
        [Description] nvarchar(max) NOT NULL,
        [Severity] nvarchar(max) NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [ReworkReportUrl] nvarchar(max) NULL,
        [RectificationNotes] nvarchar(max) NULL,
        [RectifiedAt] datetime2 NULL,
        [InspectionId] uniqueidentifier NULL,
        CONSTRAINT [PK_InspectionDefect] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_InspectionDefect_Inspections_InspectionId] FOREIGN KEY ([InspectionId]) REFERENCES [Inspections] ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202306_InitialSqlServer'
)
BEGIN
    CREATE TABLE [InspectionVisits] (
        [Id] uniqueidentifier NOT NULL,
        [WorkOrderId] uniqueidentifier NOT NULL,
        [VendorId] uniqueidentifier NOT NULL,
        [InspectorId] uniqueidentifier NOT NULL,
        [ScheduledDate] datetime2 NOT NULL,
        [ActualVisitDate] datetime2 NULL,
        [Purpose] nvarchar(max) NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [Remarks] nvarchar(max) NULL,
        [AttachmentUrl] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_InspectionVisits] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_InspectionVisits_Inspectors_InspectorId] FOREIGN KEY ([InspectorId]) REFERENCES [Inspectors] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202306_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_InspectionDefect_InspectionId] ON [InspectionDefect] ([InspectionId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202306_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_InspectionVisits_InspectorId] ON [InspectionVisits] ([InspectorId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202306_InitialSqlServer'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260730202306_InitialSqlServer', N'8.0.0');
END;
GO

COMMIT;
GO

