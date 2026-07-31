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
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Milestones] (
        [Id] uniqueidentifier NOT NULL,
        [ProjectId] uniqueidentifier NULL,
        [WorkOrderId] uniqueidentifier NULL,
        [Title] nvarchar(max) NOT NULL,
        [Weightage] decimal(18,2) NOT NULL,
        [PaymentPercentage] decimal(18,2) NOT NULL,
        [TargetDate] datetime2 NOT NULL,
        [CompletionDate] datetime2 NULL,
        [Status] nvarchar(max) NOT NULL,
        [Remarks] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_Milestones] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE TABLE [MilestoneTemplates] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Description] nvarchar(max) NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_MilestoneTemplates] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE TABLE [Queries] (
        [Id] uniqueidentifier NOT NULL,
        [VendorId] uniqueidentifier NOT NULL,
        [Subject] nvarchar(max) NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Queries] PRIMARY KEY ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE TABLE [MilestoneSubmissions] (
        [Id] uniqueidentifier NOT NULL,
        [MilestoneId] uniqueidentifier NOT NULL,
        [VendorId] uniqueidentifier NOT NULL,
        [ProjectId] uniqueidentifier NOT NULL,
        [Notes] nvarchar(max) NOT NULL,
        [LinkedReportIds] nvarchar(max) NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [SubmittedAt] datetime2 NULL,
        [IsImmutable] bit NOT NULL,
        CONSTRAINT [PK_MilestoneSubmissions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_MilestoneSubmissions_Milestones_MilestoneId] FOREIGN KEY ([MilestoneId]) REFERENCES [Milestones] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE TABLE [ProgressReports] (
        [Id] uniqueidentifier NOT NULL,
        [ProjectId] uniqueidentifier NOT NULL,
        [VendorId] uniqueidentifier NOT NULL,
        [PhysicalPercentage] decimal(18,2) NOT NULL,
        [WorkDescription] nvarchar(max) NOT NULL,
        [Latitude] float NOT NULL,
        [Longitude] float NOT NULL,
        [MediaUrls] nvarchar(max) NOT NULL,
        [ReportedAt] datetime2 NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [IsImmutable] bit NOT NULL,
        [InspectorRemarks] nvarchar(max) NULL,
        [ReviewedByInspectorId] uniqueidentifier NULL,
        [InspectorReviewedAt] datetime2 NULL,
        [InspectorRecommendation] nvarchar(max) NULL,
        [MilestoneId] uniqueidentifier NULL,
        CONSTRAINT [PK_ProgressReports] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProgressReports_Milestones_MilestoneId] FOREIGN KEY ([MilestoneId]) REFERENCES [Milestones] ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE TABLE [MilestoneTemplateItem] (
        [Id] uniqueidentifier NOT NULL,
        [MilestoneTemplateId] uniqueidentifier NOT NULL,
        [StepName] nvarchar(max) NOT NULL,
        [PercentageReleasing] decimal(18,2) NOT NULL,
        [SequenceOrder] int NOT NULL,
        CONSTRAINT [PK_MilestoneTemplateItem] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_MilestoneTemplateItem_MilestoneTemplates_MilestoneTemplateId] FOREIGN KEY ([MilestoneTemplateId]) REFERENCES [MilestoneTemplates] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE TABLE [QueryMessages] (
        [Id] uniqueidentifier NOT NULL,
        [QueryId] uniqueidentifier NULL,
        [Content] nvarchar(max) NOT NULL,
        [Timestamp] datetime2 NOT NULL,
        [SenderRole] nvarchar(max) NOT NULL,
        [SenderName] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_QueryMessages] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_QueryMessages_Queries_QueryId] FOREIGN KEY ([QueryId]) REFERENCES [Queries] ([Id])
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE TABLE [MilestoneDocuments] (
        [Id] uniqueidentifier NOT NULL,
        [MilestoneSubmissionId] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Type] nvarchar(max) NOT NULL,
        [Url] nvarchar(max) NOT NULL,
        [Size] nvarchar(max) NOT NULL,
        [UploadedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_MilestoneDocuments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_MilestoneDocuments_MilestoneSubmissions_MilestoneSubmissionId] FOREIGN KEY ([MilestoneSubmissionId]) REFERENCES [MilestoneSubmissions] ([Id]) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_MilestoneDocuments_MilestoneSubmissionId] ON [MilestoneDocuments] ([MilestoneSubmissionId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_MilestoneSubmissions_MilestoneId] ON [MilestoneSubmissions] ([MilestoneId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_MilestoneTemplateItem_MilestoneTemplateId] ON [MilestoneTemplateItem] ([MilestoneTemplateId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_ProgressReports_MilestoneId] ON [ProgressReports] ([MilestoneId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    CREATE INDEX [IX_QueryMessages_QueryId] ON [QueryMessages] ([QueryId]);
END;
GO

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260730202258_InitialSqlServer'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260730202258_InitialSqlServer', N'8.0.0');
END;
GO

COMMIT;
GO

