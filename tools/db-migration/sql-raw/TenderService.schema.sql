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
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Tenders] (
        [Id] uniqueidentifier NOT NULL,
        [TenderNo] nvarchar(max) NOT NULL,
        [Title] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NOT NULL,
        [TenderType] nvarchar(max) NOT NULL,
        [Budget] decimal(18,2) NOT NULL,
        [EMDAmount] decimal(18,2) NOT NULL,
        [Portal] nvarchar(max) NOT NULL,
        [DocumentUrl] nvarchar(max) NOT NULL,
        [PublishDate] datetime2 NULL,
        [CloseDate] datetime2 NULL,
        [Status] nvarchar(max) NOT NULL,
        [DepartmentId] uniqueidentifier NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Tenders] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE TABLE [TenderTypes] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TenderTypes] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE TABLE [TenderAllotments] (
        [Id] uniqueidentifier NOT NULL,
        [TenderId] uniqueidentifier NOT NULL,
        [L1VendorId] uniqueidentifier NULL,
        [L2VendorId] uniqueidentifier NULL,
        [L3VendorId] uniqueidentifier NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TenderAllotments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_TenderAllotments_Tenders_TenderId] FOREIGN KEY ([TenderId]) REFERENCES [Tenders] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE TABLE [WorkOrders] (
        [Id] uniqueidentifier NOT NULL,
        [TenderId] uniqueidentifier NOT NULL,
        [VendorId] uniqueidentifier NOT NULL,
        [InspectorId] uniqueidentifier NULL,
        [WorkOrderNo] nvarchar(max) NOT NULL,
        [TotalValue] decimal(18,2) NOT NULL,
        [StartDate] datetime2 NOT NULL,
        [EndDate] datetime2 NOT NULL,
        [ScopeDescription] nvarchar(max) NOT NULL,
        [PaymentTerms] nvarchar(max) NOT NULL,
        [LiquidatedDamagesTerms] nvarchar(max) NOT NULL,
        [AgreementDocumentUrl] nvarchar(max) NOT NULL,
        [DepartmentId] uniqueidentifier NULL,
        [Status] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_WorkOrders] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_WorkOrders_Tenders_TenderId] FOREIGN KEY ([TenderId]) REFERENCES [Tenders] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Projects] (
        [Id] uniqueidentifier NOT NULL,
        [WorkOrderId] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Budget] decimal(18,2) NOT NULL,
        [Progress] decimal(18,2) NOT NULL,
        [DepartmentId] uniqueidentifier NULL,
        [Status] nvarchar(max) NOT NULL,
        [Latitude] float NOT NULL,
        [Longitude] float NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Projects] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Projects_WorkOrders_WorkOrderId] FOREIGN KEY ([WorkOrderId]) REFERENCES [WorkOrders] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE TABLE [TimeExtensions] (
        [Id] uniqueidentifier NOT NULL,
        [WorkOrderId] uniqueidentifier NOT NULL,
        [VendorId] uniqueidentifier NOT NULL,
        [OriginalEndDate] datetime2 NOT NULL,
        [RequestedEndDate] datetime2 NOT NULL,
        [ApprovedEndDate] datetime2 NULL,
        [Reason] nvarchar(max) NOT NULL,
        [DocumentUrl] nvarchar(max) NULL,
        [Status] nvarchar(max) NOT NULL,
        [DecisionRemarks] nvarchar(max) NULL,
        [DecidedByUserId] uniqueidentifier NULL,
        [DecidedAt] datetime2 NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TimeExtensions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_TimeExtensions_WorkOrders_WorkOrderId] FOREIGN KEY ([WorkOrderId]) REFERENCES [WorkOrders] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_Projects_WorkOrderId] ON [Projects] ([WorkOrderId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_TenderAllotments_TenderId] ON [TenderAllotments] ([TenderId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_TimeExtensions_WorkOrderId] ON [TimeExtensions] ([WorkOrderId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_WorkOrders_TenderId] ON [WorkOrders] ([TenderId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202251_InitialSqlServer'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260730202251_InitialSqlServer', N'8.0.0');
END;
GO

COMMIT;
GO

