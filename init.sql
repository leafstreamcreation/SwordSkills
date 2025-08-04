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
