-- Initialize the database schema
CREATE TABLE names (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  tag VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE skills (
  id SERIAL PRIMARY KEY,
  name_id INTEGER REFERENCES names(id) ON DELETE RESTRICT,
  proficiency INTEGER NOT NULL,
  years INTEGER,
  icon VARCHAR(255),
  image VARCHAR(255),
  description TEXT,
  url VARCHAR(255)
);

CREATE TABLE skill_tags (
  skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (skill_id, tag_id)
);

-- Insert some sample data
INSERT INTO names (name) VALUES 
  ('JavaScript'),
  ('Node.js'),
  ('PostgreSQL'),
  ('Docker'),
  ('Express.js');

INSERT INTO tags (tag) VALUES 
  ('Programming'),
  ('Backend'),
  ('Database'),
  ('DevOps'),
  ('Web Development');

INSERT INTO skills (name_id, proficiency, years, description) VALUES 
  (1, 8, 5, 'Advanced JavaScript development including ES6+ features'),
  (2, 7, 3, 'Server-side development with Node.js'),
  (3, 6, 2, 'Database design and optimization'),
  (4, 5, 1, 'Containerization and deployment'),
  (5, 7, 3, 'RESTful API development');

INSERT INTO skill_tags (skill_id, tag_id) VALUES 
  (1, 1), (1, 5),
  (2, 1), (2, 2), (2, 5),
  (3, 3),
  (4, 4),
  (5, 2), (5, 5);
