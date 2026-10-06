const { pool } = require('../config/database');

class SettingsController {
  // Get all settings
  static async getAllSettings(req, res) {
    try {
      const connection = await pool.getConnection();
      const [settings] = await connection.execute('SELECT * FROM library_settings ORDER BY category, id');
      connection.release();

      // Group by category
      const groupedSettings = settings.reduce((acc, curr) => {
        if (!acc[curr.category]) {
          acc[curr.category] = {};
        }
        acc[curr.category][curr.setting_key] = {
          value: curr.setting_value,
          description: curr.description,
          type: curr.data_type,
          id: curr.id
        };

        // Also aggregate circulation and fines under 'library' for the clean Library Rules tab
        if (curr.category === 'circulation' || curr.category === 'fines') {
          if (!acc['library']) {
            acc['library'] = {};
          }
          acc['library'][curr.setting_key] = {
            value: curr.setting_value,
            description: curr.description,
            type: curr.data_type,
            id: curr.id
          };
        }
        return acc;
      }, {});

      res.json({
        success: true,
        settings: groupedSettings
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
  }

  // Get settings by category
  static async getSettingsByCategory(req, res) {
    try {
      const { category } = req.params;
      const connection = await pool.getConnection();
      const [settings] = await connection.execute('SELECT * FROM library_settings WHERE category = ?', [category]);
      connection.release();

      res.json({
        success: true,
        settings
      });
    } catch (error) {
      console.error('Error fetching settings by category:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch settings' });
    }
  }

  // Get public settings
  static async getPublicSettings(req, res) {
    try {
      const connection = await pool.getConnection();
      const [settings] = await connection.execute("SELECT setting_key, setting_value, data_type FROM library_settings WHERE category = 'general'");
      connection.release();

      const publicSettings = {};
      settings.forEach(setting => {
        let val = setting.setting_value;
        if (setting.data_type === 'boolean') val = val === 'true';
        else if (setting.data_type === 'number') val = Number(val);
        publicSettings[setting.setting_key] = val;
      });

      res.json({
        success: true,
        settings: publicSettings
      });
    } catch (error) {
      console.error('Error fetching public settings:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch public settings' });
    }
  }

  // Update settings
  static async updateSettings(req, res) {
    const settingsData = req.body.settings; // Expected array of { key, value }

    if (!Array.isArray(settingsData) || settingsData.length === 0) {
      return res.status(400).json({ success: false, error: 'Settings must be an array of objects' });
    }

    try {
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      for (const item of settingsData) {
        if (!item || !item.key) continue;
        const valStr = item.value !== undefined && item.value !== null ? String(item.value).trim() : '';

        // If setting exists, update it. If not, insert it
        const [existing] = await connection.execute(
          'SELECT id FROM library_settings WHERE setting_key = ? LIMIT 1',
          [item.key]
        );

        if (existing.length > 0) {
          await connection.execute(
            'UPDATE library_settings SET setting_value = ? WHERE setting_key = ?',
            [valStr, item.key]
          );
        } else {
          const category = item.category || 'general';
          const dataType = item.type || (typeof item.value === 'number' ? 'number' : 'string');
          await connection.execute(
            'INSERT INTO library_settings (setting_key, setting_value, category, data_type) VALUES (?, ?, ?, ?)',
            [item.key, valStr, category, dataType]
          );
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: 'Settings updated successfully'
      });
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ success: false, error: 'Failed to update settings' });
    }
  }

  // Static helper to get setting value
  static async getSetting(key, defaultValue = null) {
    try {
      const [rows] = await pool.query(
        'SELECT setting_value, data_type FROM library_settings WHERE setting_key = ? LIMIT 1',
        [key]
      );
      if (rows.length === 0) return defaultValue;
      const { setting_value, data_type } = rows[0];
      if (data_type === 'number') return Number(setting_value);
      if (data_type === 'boolean') return setting_value === 'true' || setting_value === '1';
      return setting_value;
    } catch (err) {
      return defaultValue;
    }
  }
}

module.exports = SettingsController;
