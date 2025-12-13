import express from 'express';
import { getConnection } from '../config/database';

const router = express.Router();

// Get all scheduled records
router.get('/', async (req, res) => {
  try {
    const connection = await getConnection();
    const result = await connection.request()
      .query('SELECT * FROM dbo.Scheduled ORDER BY ScheduledID');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching scheduled records:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch scheduled records', details: errorMessage });
  }
});

// Get scheduled record by ID
router.get('/:id', async (req, res) => {
  try {
    const connection = await getConnection();
    const result = await connection.request()
      .input('id', req.params.id)
      .query('SELECT * FROM dbo.Scheduled WHERE ScheduledID = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Scheduled record not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching scheduled record:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch scheduled record', details: errorMessage });
  }
});

// Create new scheduled record
router.post('/', async (req, res) => {
  try {
    const {
      Type,
      PurchaseDate,
      Supplier,
      Description,
      PurchaseCurrency,
      OriginalCurrencyValue,
      USDValue,
      UsefulMonths,
      Disposed = false,
      DisposalDate
    } = req.body;

    const connection = await getConnection();
    const result = await connection.request()
      .input('Type', Type)
      .input('PurchaseDate', PurchaseDate)
      .input('Supplier', Supplier || null)
      .input('Description', Description || null)
      .input('PurchaseCurrency', PurchaseCurrency)
      .input('OriginalCurrencyValue', OriginalCurrencyValue)
      .input('USDValue', USDValue)
      .input('UsefulMonths', UsefulMonths)
      .input('Disposed', Disposed)
      .input('DisposalDate', DisposalDate || null)
      .query(`
        INSERT INTO dbo.Scheduled (
          Type, PurchaseDate, Supplier, Description, PurchaseCurrency,
          OriginalCurrencyValue, USDValue, UsefulMonths, Disposed, DisposalDate
        )
        OUTPUT INSERTED.ScheduledID, INSERTED.Type, INSERTED.PurchaseDate,
               INSERTED.Supplier, INSERTED.Description, INSERTED.PurchaseCurrency,
               INSERTED.OriginalCurrencyValue, INSERTED.USDValue, INSERTED.UsefulMonths,
               INSERTED.Disposed, INSERTED.DisposalDate
        VALUES (
          @Type, @PurchaseDate, @Supplier, @Description, @PurchaseCurrency,
          @OriginalCurrencyValue, @USDValue, @UsefulMonths, @Disposed, @DisposalDate
        )
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating scheduled record:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to create scheduled record', details: errorMessage });
  }
});

// Update scheduled record
router.put('/:id', async (req, res) => {
  try {
    const {
      Type,
      PurchaseDate,
      Supplier,
      Description,
      PurchaseCurrency,
      OriginalCurrencyValue,
      USDValue,
      UsefulMonths,
      Disposed,
      DisposalDate
    } = req.body;

    const connection = await getConnection();
    const result = await connection.request()
      .input('id', req.params.id)
      .input('Type', Type)
      .input('PurchaseDate', PurchaseDate)
      .input('Supplier', Supplier || null)
      .input('Description', Description || null)
      .input('PurchaseCurrency', PurchaseCurrency)
      .input('OriginalCurrencyValue', OriginalCurrencyValue)
      .input('USDValue', USDValue)
      .input('UsefulMonths', UsefulMonths)
      .input('Disposed', Disposed)
      .input('DisposalDate', DisposalDate || null)
      .query(`
        UPDATE dbo.Scheduled
        SET Type = @Type,
            PurchaseDate = @PurchaseDate,
            Supplier = @Supplier,
            Description = @Description,
            PurchaseCurrency = @PurchaseCurrency,
            OriginalCurrencyValue = @OriginalCurrencyValue,
            USDValue = @USDValue,
            UsefulMonths = @UsefulMonths,
            Disposed = @Disposed,
            DisposalDate = @DisposalDate
        OUTPUT INSERTED.ScheduledID, INSERTED.Type, INSERTED.PurchaseDate,
               INSERTED.Supplier, INSERTED.Description, INSERTED.PurchaseCurrency,
               INSERTED.OriginalCurrencyValue, INSERTED.USDValue, INSERTED.UsefulMonths,
               INSERTED.Disposed, INSERTED.DisposalDate
        WHERE ScheduledID = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Scheduled record not found' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error updating scheduled record:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to update scheduled record', details: errorMessage });
  }
});

// Delete scheduled record
router.delete('/:id', async (req, res) => {
  try {
    const connection = await getConnection();
    const result = await connection.request()
      .input('id', req.params.id)
      .query('DELETE FROM dbo.Scheduled OUTPUT DELETED.ScheduledID WHERE ScheduledID = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Scheduled record not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting scheduled record:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to delete scheduled record', details: errorMessage });
  }
});

export default router;