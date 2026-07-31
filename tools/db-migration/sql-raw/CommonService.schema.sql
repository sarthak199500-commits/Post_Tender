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
    WHERE [MigrationId] = N'20260730202321_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Alerts] (
        [Id] uniqueidentifier NOT NULL,
        [Type] nvarchar(max) NOT NULL,
        [Title] nvarchar(max) NOT NULL,
        [Message] nvarchar(max) NOT NULL,
        [TargetRole] nvarchar(max) NULL,
        [TargetUserId] uniqueidentifier NULL,
        [TargetVendorId] uniqueidentifier NULL,
        [EntityName] nvarchar(max) NULL,
        [RecordId] nvarchar(max) NULL,
        [Link] nvarchar(max) NULL,
        [RaisedByUserId] uniqueidentifier NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Alerts] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202321_InitialSqlServer'
)
BEGIN
    CREATE TABLE [AuditLogs] (
        [Id] uniqueidentifier NOT NULL,
        [EntityName] nvarchar(max) NOT NULL,
        [RecordId] nvarchar(max) NOT NULL,
        [Action] nvarchar(max) NOT NULL,
        [UserId] uniqueidentifier NULL,
        [Timestamp] datetime2 NOT NULL,
        [ChangesInfo] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_AuditLogs] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202321_InitialSqlServer'
)
BEGIN
    CREATE TABLE [ContractDocuments] (
        [Id] uniqueidentifier NOT NULL,
        [VendorId] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Type] nvarchar(max) NOT NULL,
        [Size] nvarchar(max) NOT NULL,
        [Url] nvarchar(max) NOT NULL,
        [UploadedAt] datetime2 NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_ContractDocuments] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202321_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Locations] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Code] nvarchar(max) NOT NULL,
        [ParentLocationId] uniqueidentifier NULL,
        [LocationType] nvarchar(max) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Locations] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202321_InitialSqlServer'
)
BEGIN
    CREATE TABLE [AlertReads] (
        [Id] uniqueidentifier NOT NULL,
        [AlertId] uniqueidentifier NOT NULL,
        [UserId] uniqueidentifier NOT NULL,
        [ReadAt] datetime2 NOT NULL,
        CONSTRAINT [PK_AlertReads] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AlertReads_Alerts_AlertId] FOREIGN KEY ([AlertId]) REFERENCES [Alerts] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202321_InitialSqlServer'
)
BEGIN
    CREATE UNIQUE INDEX [IX_AlertReads_AlertId_UserId] ON [AlertReads] ([AlertId], [UserId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202321_InitialSqlServer'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260730202321_InitialSqlServer', N'8.0.0');
END;
GO

COMMIT;
GO

