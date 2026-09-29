-- ============================================================================
-- CORENOW Codebase Analyzer - Multi-User & Project Snapshots MSSQL Schema
-- Compatibility: Microsoft SQL Server 2016+ / Azure SQL / SQLite Fallback
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[users] (
        [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
        [username] NVARCHAR(100) NOT NULL UNIQUE,
        [email] NVARCHAR(255) NOT NULL UNIQUE,
        [password_hash] NVARCHAR(255) NULL,
        [role] NVARCHAR(50) NOT NULL DEFAULT 'developer',
        [is_active] BIT NOT NULL DEFAULT 1,
        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [last_login] DATETIME2 NULL,
        [github_id] NVARCHAR(100) NULL,
        [avatar_url] NVARCHAR(500) NULL
    );

    CREATE INDEX [IX_users_username] ON [dbo].[users]([username]);
    CREATE INDEX [IX_users_email] ON [dbo].[users]([email]);
    CREATE UNIQUE INDEX [IX_users_github_id] ON [dbo].[users]([github_id]) WHERE [github_id] IS NOT NULL;
END
ELSE
BEGIN
    -- Auto-migration for existing tables
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'github_id')
    BEGIN
        ALTER TABLE [dbo].[users] ADD [github_id] NVARCHAR(100) NULL;
        CREATE UNIQUE INDEX [IX_users_github_id] ON [dbo].[users]([github_id]) WHERE [github_id] IS NOT NULL;
    END
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'avatar_url')
    BEGIN
        ALTER TABLE [dbo].[users] ADD [avatar_url] NVARCHAR(500) NULL;
    END
    BEGIN TRY
        ALTER TABLE [dbo].[users] ALTER COLUMN [password_hash] NVARCHAR(255) NULL;
    END TRY
    BEGIN CATCH
    END CATCH
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[projects]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[projects] (
        [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
        [user_id] NVARCHAR(64) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [description] NVARCHAR(MAX) NULL,
        [is_public] BIT NOT NULL DEFAULT 0,
        [share_token] NVARCHAR(128) NULL UNIQUE,
        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_projects_users] FOREIGN KEY ([user_id]) REFERENCES [dbo].[users]([id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_projects_user_id] ON [dbo].[projects]([user_id]);
    CREATE INDEX [IX_projects_share_token] ON [dbo].[projects]([share_token]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[project_snapshots]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[project_snapshots] (
        [id] NVARCHAR(64) NOT NULL PRIMARY KEY,
        [project_id] NVARCHAR(64) NOT NULL,
        [version] NVARCHAR(50) NOT NULL DEFAULT '1.0.0',
        [metrics_json] NVARCHAR(MAX) NOT NULL,
        [file_tree_json] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_snapshots_projects] FOREIGN KEY ([project_id]) REFERENCES [dbo].[projects]([id]) ON DELETE CASCADE
    );

    CREATE INDEX [IX_snapshots_project_id] ON [dbo].[project_snapshots]([project_id]);
END
GO
