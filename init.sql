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
  url VARCHAR(255),
  parent_id INTEGER REFERENCES skills(id) ON DELETE CASCADE
);

CREATE TABLE skill_tags (
  skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (skill_id, tag_id)
);

-- Constraint to prevent multi-level nesting (subskills cannot have subskills)
-- This is implemented as a trigger since CHECK constraints cannot reference other rows
CREATE OR REPLACE FUNCTION check_no_nested_subskills()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM skills WHERE id = NEW.parent_id AND parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Subskills cannot have their own subskills (multi-level nesting not allowed)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_no_nested_subskills
  BEFORE INSERT OR UPDATE ON skills
  FOR EACH ROW
  EXECUTE FUNCTION check_no_nested_subskills();