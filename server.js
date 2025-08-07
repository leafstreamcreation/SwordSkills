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

// Helper function to create a single skill (used for both main skills and subskills)
const createSingleSkill = async (client, skillData, parentId = null) => {
  const { name, proficiency, years, icon, image, description, url, tags = [] } = skillData;
  
  // Validation
  if (!name || proficiency === undefined) {
    throw new Error('Name and proficiency are required');
  }
  
  if (proficiency < 1 || proficiency > 100) {
    throw new Error('Proficiency must be between 1 and 100');
  }
  
  // Get or create name
  const nameId = await getOrCreateName(client, name);
  
  // Create skill
  const skillResult = await client.query(
    `INSERT INTO skills (name_id, proficiency, years, icon, image, description, url, parent_id) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [nameId, proficiency, years, icon, image, description, url, parentId]
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
  
  return skillId;
};

// Helper function to update a single skill
const updateSingleSkill = async (client, skillId, skillData) => {
  const { name, proficiency, years, icon, image, description, url, tags } = skillData;
  
  // Validation
  if (proficiency !== undefined && (proficiency < 1 || proficiency > 100)) {
    throw new Error('Proficiency must be between 1 and 100');
  }
  
  // Check if skill exists
  const existingSkill = await client.query('SELECT * FROM skills WHERE id = $1', [skillId]);
  if (existingSkill.rows.length === 0) {
    throw new Error('Skill not found');
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
    [nameId, proficiency, years, icon, image, description, url, skillId]
  );
  
  // Update tags if provided
  if (tags !== undefined) {
    // Remove existing tags
    await client.query('DELETE FROM skill_tags WHERE skill_id = $1', [skillId]);
    
    // Add new tags
    if (tags.length > 0) {
      const tagIds = await getOrCreateTags(client, tags);
      
      for (const tagId of tagIds) {
        await client.query(
          'INSERT INTO skill_tags (skill_id, tag_id) VALUES ($1, $2)',
          [skillId, tagId]
        );
      }
    }
  }
};

// Helper function to fetch skill with subskills
const fetchSkillWithSubskills = async (client, skillId) => {
  // Fetch main skill
  const mainSkillQuery = `
    SELECT s.id, n.name, s.proficiency, s.years, s.icon, s.image, 
           s.description, s.url, s.parent_id,
           ARRAY_AGG(t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags
    FROM skills s
    JOIN names n ON s.name_id = n.id
    LEFT JOIN skill_tags st ON s.id = st.skill_id
    LEFT JOIN tags t ON st.tag_id = t.id
    WHERE s.id = $1
    GROUP BY s.id, n.name
  `;
  
  const mainSkillResult = await client.query(mainSkillQuery, [skillId]);
  if (mainSkillResult.rows.length === 0) {
    return null;
  }
  
  const skill = mainSkillResult.rows[0];
  
  // Fetch subskills if this is a main skill (parent_id is null)
  if (skill.parent_id === null) {
    const subskillsQuery = `
      SELECT s.id, n.name, s.proficiency, s.years, s.icon, s.image, 
             s.description, s.url,
             ARRAY_AGG(t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags
      FROM skills s
      JOIN names n ON s.name_id = n.id
      LEFT JOIN skill_tags st ON s.id = st.skill_id
      LEFT JOIN tags t ON st.tag_id = t.id
      WHERE s.parent_id = $1
      GROUP BY s.id, n.name
      ORDER BY s.id
    `;
    
    const subskillsResult = await client.query(subskillsQuery, [skillId]);
    skill.subskills = subskillsResult.rows;
  }
  
  // Remove parent_id from response for cleaner API
  delete skill.parent_id;
  
  return skill;
};

// GET /skills - Get paginated skills with filtering
app.get('/skills', async (req, res) => {
  try {
    const { page, pageSize, offset } = getPaginationParams(req);
    const { proficiency, years, tags } = req.query;
    
    let query = `
      SELECT s.id, n.name, s.proficiency, s.years, s.icon, s.image, 
             s.description, s.url, 
             ARRAY_AGG(DISTINCT t.tag) FILTER (WHERE t.tag IS NOT NULL) as tags,
             COUNT(DISTINCT sub.id) as subskills_count
      FROM skills s
      JOIN names n ON s.name_id = n.id
      LEFT JOIN skill_tags st ON s.id = st.skill_id
      LEFT JOIN tags t ON st.tag_id = t.id
      LEFT JOIN skills sub ON sub.parent_id = s.id
      WHERE s.parent_id IS NULL
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
      query += ' AND ' + conditions.join(' AND ');
    }
    
    query += ' GROUP BY s.id, n.name';
    query += ` ORDER BY s.id LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(pageSize, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination (only top-level skills)
    let countQuery = 'SELECT COUNT(DISTINCT s.id) FROM skills s JOIN names n ON s.name_id = n.id WHERE s.parent_id IS NULL';
    if (conditions.length > 0) {
      countQuery += ' AND ' + conditions.join(' AND ');
    }
    
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const totalCount = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalCount / pageSize);
    
    // Fetch subskills for each main skill
    const skillsWithSubskills = [];
    for (const skill of result.rows) {
      const skillWithSubskills = await fetchSkillWithSubskills(pool, skill.id);
      skillsWithSubskills.push(skillWithSubskills);
    }
    
    res.json({
      data: skillsWithSubskills,
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

// GET /skills/:id - Get skill by ID
app.get('/skills/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const skill = await fetchSkillWithSubskills(pool, id);
    
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    res.json(skill);
  } catch (error) {
    console.error('Error fetching skill:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /skills - Create new skill
app.post('/skills', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { subskills = [], ...mainSkillData } = req.body;
    
    // Validate subskills don't contain their own subskills
    for (const subskill of subskills) {
      if (subskill.subskills && subskill.subskills.length > 0) {
        return res.status(400).json({ 
          error: 'Subskills cannot have their own subskills (multi-level nesting not allowed)' 
        });
      }
    }
    
    // Create main skill
    const skillId = await createSingleSkill(client, mainSkillData);
    
    // Create subskills
    for (const subskillData of subskills) {
      await createSingleSkill(client, subskillData, skillId);
    }
    
    await client.query('COMMIT');
    
    // Fetch the created skill with subskills
    const newSkill = await fetchSkillWithSubskills(client, skillId);
    
    res.status(201).json(newSkill);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating skill:', error);
    
    if (error.message.includes('required') || error.message.includes('must be between')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    client.release();
  }
});

// POST /skills/:id - Update skill
app.post('/skills/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { subskills, ...mainSkillData } = req.body;
    
    // Check if skill exists and is a main skill (not a subskill)
    const existingSkill = await client.query('SELECT * FROM skills WHERE id = $1', [id]);
    if (existingSkill.rows.length === 0) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    if (existingSkill.rows[0].parent_id !== null) {
      return res.status(400).json({ error: 'Cannot update subskills directly. Update the parent skill instead.' });
    }
    
    // Validate subskills don't contain their own subskills
    if (subskills) {
      for (const subskill of subskills) {
        if (subskill.subskills && subskill.subskills.length > 0) {
          return res.status(400).json({ 
            error: 'Subskills cannot have their own subskills (multi-level nesting not allowed)' 
          });
        }
      }
    }
    
    // Update main skill if any main skill data is provided
    const hasMainSkillData = Object.keys(mainSkillData).some(key => 
      ['name', 'proficiency', 'years', 'icon', 'image', 'description', 'url', 'tags'].includes(key)
    );
    
    if (hasMainSkillData) {
      await updateSingleSkill(client, id, mainSkillData);
    }
    
    // Handle subskills updates if provided
    if (subskills !== undefined) {
      // Get existing subskills
      const existingSubskills = await client.query(
        'SELECT id FROM skills WHERE parent_id = $1 ORDER BY id',
        [id]
      );
      
      const existingSubskillIds = existingSubskills.rows.map(row => row.id);
      const updatedSubskillIds = [];
      
      // Process each subskill in the request
      for (const subskillData of subskills) {
        if (subskillData.id) {
          // Update existing subskill
          if (existingSubskillIds.includes(subskillData.id)) {
            await updateSingleSkill(client, subskillData.id, subskillData);
            updatedSubskillIds.push(subskillData.id);
          } else {
            throw new Error(`Subskill with id ${subskillData.id} does not belong to this skill`);
          }
        } else {
          // Create new subskill
          const newSubskillId = await createSingleSkill(client, subskillData, id);
          updatedSubskillIds.push(newSubskillId);
        }
      }
      
      // Delete subskills that are no longer in the request
      const subskillsToDelete = existingSubskillIds.filter(id => !updatedSubskillIds.includes(id));
      for (const subskillId of subskillsToDelete) {
        await client.query('DELETE FROM skills WHERE id = $1', [subskillId]);
      }
    }
    
    await client.query('COMMIT');
    
    // Fetch the updated skill with subskills
    const updatedSkill = await fetchSkillWithSubskills(client, id);
    
    res.json(updatedSkill);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating skill:', error);
    
    if (error.message.includes('required') || 
        error.message.includes('must be between') || 
        error.message.includes('does not belong') ||
        error.message.includes('Cannot update')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    client.release();
  }
});

// POST /skills/:id/delete - Delete skill
app.post('/skills/:id/delete', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Check if skill exists
    const existingSkill = await client.query('SELECT parent_id FROM skills WHERE id = $1', [id]);
    if (existingSkill.rows.length === 0) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    
    // Count subskills if this is a main skill
    let subskillsCount = 0;
    if (existingSkill.rows[0].parent_id === null) {
      const subskillsResult = await client.query(
        'SELECT COUNT(*) FROM skills WHERE parent_id = $1',
        [id]
      );
      subskillsCount = parseInt(subskillsResult.rows[0].count);
    }
    
    // Delete the skill (subskills will be deleted automatically due to CASCADE)
    const result = await client.query('DELETE FROM skills WHERE id = $1 RETURNING id', [id]);
    
    await client.query('COMMIT');
    
    res.json({ 
      message: 'Skill deleted successfully', 
      id: parseInt(id),
      deletedSubskills: subskillsCount
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting skill:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /admin/prune - Remove unused names and tags
app.post('/admin/prune', async (req, res) => {
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
