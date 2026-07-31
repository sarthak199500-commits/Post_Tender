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
    WHERE [MigrationId] = N'20260730202152_InitialSqlServer'
)
BEGIN
    CREATE TABLE [VendorCategories] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_VendorCategories] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202152_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Vendors] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [RegistrationNumber] nvarchar(max) NOT NULL,
        [VendorCode] nvarchar(450) NOT NULL,
        [GSTNo] nvarchar(max) NOT NULL,
        [YearOfIncorporation] int NULL,
        [AuthPersonName] nvarchar(max) NOT NULL,
        [Mobile] nvarchar(max) NOT NULL,
        [AlternativeNumber] nvarchar(max) NOT NULL,
        [ContactEmail] nvarchar(max) NOT NULL,
        [RegistrationDetails] nvarchar(max) NOT NULL,
        [CategoryId] uniqueidentifier NULL,
        [UserId] uniqueidentifier NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [PerformanceScore] decimal(18,2) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Vendors] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Vendors_VendorCategories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [VendorCategories] ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202152_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_Vendors_CategoryId] ON [Vendors] ([CategoryId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202152_InitialSqlServer'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Vendors_VendorCode] ON [Vendors] ([VendorCode]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202152_InitialSqlServer'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260730202152_InitialSqlServer', N'8.0.0');
END;
GO

COMMIT;
GO

