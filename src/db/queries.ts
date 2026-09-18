export const SYS024_JOB_QUERY = `
WITH base AS (
    SELECT
        SYS024.I_RUNID,
        SYS024.T_START,
        CASE
            WHEN M_NOTES LIKE '%IMPORTPAYMENTS-SCHEDULED%' THEN 'Import Payments AutoPay/PAP'
            WHEN M_NOTES LIKE '%IMPORTPAYMENTS-IVR%' THEN 'Import Pending Payments-IVR'
            WHEN M_NOTES LIKE '%IMPORTPAYMENTS-CP%' THEN 'Import Pending Payments-CP'
            WHEN M_NOTES LIKE '%IMPORTPAYMENTS-AD%' THEN 'Import Pending Payments-AD'
            WHEN M_NOTES LIKE '%IMPORTPAYMENTS-01%' THEN 'Import Pending Payments-01'
            WHEN M_NOTES LIKE '%IMPORTPAYMENTS-10%' THEN 'Import Pending Payments-10'
            WHEN M_NOTES LIKE '%IMPORTPAYMENTS-WEB%' THEN 'Import Pending Payments-WEB'
            WHEN M_NOTES LIKE '%EmailProcess%' THEN 'eBill Notification'
            WHEN M_NOTES LIKE '%Paymentus Daily CIF Export%' THEN 'Export CIF File'
            ELSE '999'
        END AS ProcessName,
        CASE WHEN CHARINDEX('ProcessResult', M_NOTES) > 0
            THEN LTRIM(RTRIM(REPLACE(REPLACE(
                SUBSTRING(M_NOTES, CHARINDEX('ProcessResult', M_NOTES), 1000)
               , 'ProcessResult = ( ', ''),')','')))
            ELSE ''
        END AS ErrorMessage,
        C_PROCESS,
        C_USERID
    FROM advanced.SYS024
    WHERE C_STATIONID = 'DXSCHEDULE02'
      -- NOTE: keep plain GETDATE() here. AT TIME ZONE needs SQL Server 2016+
      -- and breaks this server. This query is read-only; nothing is changed
      -- in the server or database. Eastern-time rendering happens in the app.
      AND T_START >= DATEADD(DAY, -2, GETDATE())
),
Parsed AS (
    SELECT
        d.I_RUNID,
        d.T_START,
        d.C_PROCESS,
        d.ProcessName,
        d.C_USERID,
        LTRIM(RTRIM(LEFT(kv.raw, CHARINDEX('=', kv.raw) - 1))) AS [Key],
        LTRIM(RTRIM(SUBSTRING(kv.raw, CHARINDEX('=', kv.raw) + 1, 4000))) AS [Value]
    FROM base d
    CROSS APPLY (
        SELECT CAST('<x>' + REPLACE(
            REPLACE(REPLACE(d.ErrorMessage, '&', '&amp;'), '<', '&lt;'),
            ' || ', '</x><x>') + '</x>' AS XML) AS XmlData
        WHERE NULLIF(d.ErrorMessage,'') IS NOT NULL
    ) xmlData
    CROSS APPLY xmlData.XmlData.nodes('/x') AS x(XmlValue)
    CROSS APPLY (SELECT LTRIM(RTRIM(x.XmlValue.value('.', 'NVARCHAR(MAX)'))) AS raw) kv
    WHERE CHARINDEX('=', kv.raw) > 0
),
Pivoted AS (
    SELECT *
    FROM Parsed
    PIVOT (
        MAX([Value])
        FOR [Key] IN (
            [Success],
            [Total records],
            [Successfully processed],
            [Failed],
            [Skipped],
            [Feedback],
            [CustomReturn],
            [ResultDetails],
            [ProcessStart],
            [ProcessEnd]
        )
    ) AS p
)
SELECT * FROM Pivoted
ORDER BY I_RUNID DESC;
`;

export type JobDetail = {
  I_RUNID: number;
  T_START: Date;
  C_PROCESS: string;
  ProcessName: string;
  C_USERID: string;
  Success: string | null;
  'Total records': string | null;
  'Successfully processed': string | null;
  Failed: string | null;
  Skipped: string | null;
  Feedback: string | null;
  CustomReturn: string | null;
  ResultDetails: string | null;
  ProcessStart: string | null;
  ProcessEnd: string | null;
};