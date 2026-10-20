-- Lets the App Service's managed identity read and write the BugTracker database, and nothing more.
-- Run by the deploy workflow after migrations, as the server's Entra administrator; safe to run again.
-- $(IDENTITY) is the managed identity's name, e.g. id-bugtracker-test.

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'$(IDENTITY)')
BEGIN
    CREATE USER [$(IDENTITY)] FROM EXTERNAL PROVIDER;
END;

IF IS_ROLEMEMBER(N'db_datareader', N'$(IDENTITY)') = 0 ALTER ROLE db_datareader ADD MEMBER [$(IDENTITY)];
IF IS_ROLEMEMBER(N'db_datawriter', N'$(IDENTITY)') = 0 ALTER ROLE db_datawriter ADD MEMBER [$(IDENTITY)];
-- The ticket-number sequence is read with NEXT VALUE FOR, which needs UPDATE on it.
GRANT UPDATE ON OBJECT::dbo.TicketNumbers TO [$(IDENTITY)];
