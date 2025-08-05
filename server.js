const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// API Key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ 
      error: 'Unauthorized: Valid API key required in X-API-Key header' 
    });
  }
  
  next();
};

// Apply API key authentication to all routes
app.use(authenticateApiKey);

// Helper function to handle pagination
const getPaginationParams = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 10));
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
};

// Helper function to get or create a name
const getOrCreateName = async (client, name) => {
  try {
    let result = await client.query('SELECT id FROM names WHERE name = $1', [name]);
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    result = await client.query('INSERT INTO names (name) VALUES ($1) RETURNING id', [name]);
    return result.rows[0].id;
  } catch (error) {
    throw error;
  }
};

// Helper function to get or create tags
const getOrCreateTags = async (client, tags) => {
  const tagIds = [];
  for (const tag of tags) {
    try {
      let result = await client.query('SELECT id FROM tags WHERE tag = $1', [tag]);
      if (result.rows.length > 0) {
        tagIds.push(result.rows[0].id);
      } else {
        result = await client.query('INSERT INTO tags (tag) VALUES ($1) RETURNING id', [tag]);
        tagIds.push(result.rows[0].id);
      }
    } catch (error) {
      throw error;
    }
  }
  return tagIds;
};

// GET /paginated - Get paginated skills with filtering
app.get('/paginated', async (req, res) => {
  try {
    const { page, pageSize, offset } = getPaginationParams(req);
    const { proficiency, years, tags } = req.query;
    
    let query = `
      SELECT s.id, n.name, s.proficiency, s.years, s.icon, s.image, 
             s.description, s.url, 
             ARRAY_AGG(t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags
      FROM skills s
      JOIN names n ON s.name_id = n.id
      LEFT JOIN skill_tags st ON s.id = st.skill_id
      LEFT JOIN tags t ON st.tag_id = t.id
    `;
    
    const conditions = [];
    const params = [];
    let paramCount = 0;
    
    if (proficiency) {
      paramCount++;
      conditions.push(`s.proficiency >= $${paramCount}`);
      params.push(parseInt(proficiency));
    }
    
    if (years) {
      paramCount++;
      conditions.push(`s.years >= $${paramCount}`);
      params.push(parseInt(years));
    }
    
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      paramCount++;
      conditions.push(`EXISTS (
        SELECT 1 FROM skill_tags st2 
        JOIN tags t2 ON st2.tag_id = t2.id 
        WHERE st2.skill_id = s.id AND t2.tag = ANY($${paramCount})
      )`);
      params.push(tagList);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY s.id, n.name';
    query += ` ORDER BY s.id LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(pageSize, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(DISTINCT s.id) FROM skills s JOIN names n ON s.name_id = n.id';
    if (conditions.length > 0) {
      countQuery += ' LEFT JOIN skill_tags st ON s.id = st.skill_id LEFT JOIN tags t ON st.tag_id = t.id';
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / pageSize);
    
    res.json({
      data: result.rows,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - Get skill by ID
app.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT s.id, n.name, s.proficiency, s.years, s.icon, s.image, 
             s.description, s.url,
             ARRAY_AGG(t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags
      FROM skills s
      JOIN names n ON s.name_id = n.id
      LEFT JOIN skill_tags st ON s.id = st.skill_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE s.id = $1
      GROUP BY s.id, n.name
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching skill:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /create - Create new skill
app.post('/create', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { name, proficiency, years, icon, image, description, url, tags = [] } = req.body;
    
    // Validation
    if (!name || proficiency === undefined) {
      return res.status(400).json({ 
        error: 'Name and proficiency are required' 
      });
    }
    
    if (proficiency < 1 || proficiency > 100) {
      return res.status(400).json({ 
        error: 'Proficiency must be between 1 and 10' 
      });
    }
    
    // Get or create name
    const nameId = await getOrCreateName(client, name);
    
    // Create skill
    const skillResult = await client.query(
      `INSERT INTO skills (name_id, proficiency, years, icon, image, description, url) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [nameId, proficiency, years, icon, image, description, url]
    );
    
    const skillId = skillResult.rows[0].id;
    
    // Handle tags
    if (tags.length > 0) {
      const tagIds = await getOrCreateTags(client, tags);
      
      for (const tagId of tagIds) {
        await client.query(
          'INSERT INTO skill_tags (skill_id, tag_id) VALUES ($1, $2)',
          [skillId, tagId]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Fetch the created skill
    const newSkill = await pool.query(`
      SELECT s.id, n.name, s.proficiency, s.years, s.icon, s.image, 
             s.description, s.url,
             ARRAY_AGG(t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags
      FROM skills s
      JOIN names n ON s.name_id = n.id
      LEFT JOIN skill_tags st ON s.id = st.skill_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE s.id = $1
      GROUP BY s.id, n.name
    `, [skillId]);
    
    res.status(201).json(newSkill.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating skill:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /update/:id - Update skill
app.post('/update/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { name, proficiency, years, icon, image, description, url, tags = [] } = req.body;
    
    // Check if skill exists
    const existingSkill = await client.query('SELECT * FROM skills WHERE id = $1', [id]);
    if (existingSkill.rows.length === 0) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    // Validation
    if (proficiency !== undefined && (proficiency < 1 || proficiency > 10)) {
      return res.status(400).json({ 
        error: 'Proficiency must be between 1 and 100' 
      });
    }
    
    let nameId = existingSkill.rows[0].name_id;
    
    // Update name if provided
    if (name) {
      nameId = await getOrCreateName(client, name);
    }
    
    // Update skill
    await client.query(
      `UPDATE skills SET 
       name_id = COALESCE($1, name_id),
       proficiency = COALESCE($2, proficiency),
       years = COALESCE($3, years),
       icon = COALESCE($4, icon),
       image = COALESCE($5, image),
       description = COALESCE($6, description),
       url = COALESCE($7, url)
       WHERE id = $8`,
      [nameId, proficiency, years, icon, image, description, url, id]
    );
    
    // Update tags if provided
    if (tags.length >= 0) {
      // Remove existing tags
      await client.query('DELETE FROM skill_tags WHERE skill_id = $1', [id]);
      
      // Add new tags
      if (tags.length > 0) {
        const tagIds = await getOrCreateTags(client, tags);
        
        for (const tagId of tagIds) {
          await client.query(
            'INSERT INTO skill_tags (skill_id, tag_id) VALUES ($1, $2)',
            [id, tagId]
          );
        }
      }
    }
    
    await client.query('COMMIT');
    
    // Fetch the updated skill
    const updatedSkill = await pool.query(`
      SELECT s.id, n.name, s.proficiency, s.years, s.icon, s.image, 
             s.description, s.url,
             ARRAY_AGG(t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags
      FROM skills s
      JOIN names n ON s.name_id = n.id
      LEFT JOIN skill_tags st ON s.id = st.skill_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE s.id = $1
      GROUP BY s.id, n.name
    `, [id]);
    
    res.json(updatedSkill.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating skill:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /delete/:id - Delete skill
app.post('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM skills WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    res.json({ message: 'Skill deleted successfully', id: parseInt(id) });
  } catch (error) {
    console.error('Error deleting skill:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /prune - Remove unused names and tags
app.post('/prune', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Remove unused names
    const unusedNamesResult = await client.query(`
      DELETE FROM names 
      WHERE id NOT IN (SELECT DISTINCT name_id FROM skills) 
      RETURNING id, name
    `);
    
    // Remove unused tags
    const unusedTagsResult = await client.query(`
      DELETE FROM tags 
      WHERE id NOT IN (SELECT DISTINCT tag_id FROM skill_tags) 
      RETURNING id, tag
    `);
    
    await client.query('COMMIT');
    
    res.json({
      message: 'Pruning completed',
      removed: {
        names: unusedNamesResult.rows,
        tags: unusedTagsResult.rows
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error pruning:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /tags - Get paginated tags
app.get('/tags', async (req, res) => {
  try {
    const { page, pageSize, offset } = getPaginationParams(req);
    
    const result = await pool.query(
      'SELECT * FROM tags ORDER BY tag LIMIT $1 OFFSET $2',
      [pageSize, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM tags');
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / pageSize);
    
    res.json({
      data: result.rows,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /names - Get paginated skill names
app.get('/names', async (req, res) => {
  try {
    const { page, pageSize, offset } = getPaginationParams(req);
    
    const result = await pool.query(
      'SELECT * FROM names ORDER BY name LIMIT $1 OFFSET $2',
      [pageSize, offset]
    );
    
    const countResult = await pool.query('SELECT COUNT(*) FROM names');
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / pageSize);
    
    res.json({
      data: result.rows,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching names:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint (no auth required for monitoring)
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(3000, () => {
  console.log(`Server running on port 3000`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});
