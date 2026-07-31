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
    WHERE [MigrationId] = N'20260730202314_InitialSqlServer'
)
BEGIN
    CREATE TABLE [BillingPolicies] (
        [Id] uniqueidentifier NOT NULL,
        [RetentionPercentage] decimal(18,2) NOT NULL,
        [AdvanceRecoveryPercentage] decimal(18,2) NOT NULL,
        [MaxAdvancePercentage] decimal(18,2) NOT NULL,
        [UpdatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_BillingPolicies] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202314_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Bills] (
        [Id] uniqueidentifier NOT NULL,
        [WorkOrderId] uniqueidentifier NOT NULL,
        [VendorId] uniqueidentifier NOT NULL,
        [BillNo] nvarchar(max) NOT NULL,
        [Type] nvarchar(max) NOT NULL,
        [Amount] decimal(18,2) NOT NULL,
        [TaxAmount] decimal(18,2) NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [AttachmentUrl] nvarchar(max) NOT NULL,
        [RejectionReason] nvarchar(max) NULL,
        [MilestoneIds] nvarchar(max) NOT NULL,
        [SubmittedAt] datetime2 NOT NULL,
        [PaidAt] datetime2 NULL,
        [PaymentVoucherNo] nvarchar(max) NULL,
        [IsImmutable] bit NOT NULL,
        [RetentionPercentage] decimal(18,2) NOT NULL,
        [RetainedAmount] decimal(18,2) NOT NULL,
        [RetentionReleased] bit NOT NULL,
        [RetentionReleasedAt] datetime2 NULL,
        [AdvanceRecovered] decimal(18,2) NOT NULL,
        CONSTRAINT [PK_Bills] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202314_InitialSqlServer'
)
BEGIN
    CREATE TABLE [TaxConfigurations] (
        [Id] uniqueidentifier NOT NULL,
        [TaxName] nvarchar(max) NOT NULL,
        [Code] nvarchar(max) NOT NULL,
        [Percentage] decimal(18,2) NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TaxConfigurations] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202314_InitialSqlServer'
)
BEGIN
    CREATE TABLE [BillDeductions] (
        [Id] uniqueidentifier NOT NULL,
        [BillId] uniqueidentifier NOT NULL,
        [Type] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NOT NULL,
        [Amount] decimal(18,2) NOT NULL,
        [IsSystemGenerated] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_BillDeductions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_BillDeductions_Bills_BillId] FOREIGN KEY ([BillId]) REFERENCES [Bills] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202314_InitialSqlServer'
)
BEGIN
    CREATE TABLE [BillPayments] (
        [Id] uniqueidentifier NOT NULL,
        [BillId] uniqueidentifier NOT NULL,
        [Amount] decimal(18,2) NOT NULL,
        [VoucherNo] nvarchar(max) NOT NULL,
        [Reference] nvarchar(max) NULL,
        [PaidByUserId] uniqueidentifier NULL,
        [PaidAt] datetime2 NOT NULL,
        CONSTRAINT [PK_BillPayments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_BillPayments_Bills_BillId] FOREIGN KEY ([BillId]) REFERENCES [Bills] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202314_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_BillDeductions_BillId] ON [BillDeductions] ([BillId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202314_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_BillPayments_BillId] ON [BillPayments] ([BillId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202314_InitialSqlServer'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260730202314_InitialSqlServer', N'8.0.0');
END;
GO

COMMIT;
GO

