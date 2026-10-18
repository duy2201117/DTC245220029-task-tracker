CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(90) NOT NULL,
  description varchar(400) NOT NULL DEFAULT '',
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS project_members (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role varchar(12) NOT NULL CHECK(role IN ('owner','member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id,user_id)
);
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title varchar(160) NOT NULL,
  description varchar(1200) NOT NULL DEFAULT '',
  status varchar(10) NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','done')),
  priority varchar(10) NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
  due_date date,
  created_by uuid NOT NULL REFERENCES users(id),
  assigned_to uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_project ON tasks(project_id,status,due_date);
CREATE INDEX idx_tasks_assignee ON tasks(assigned_to);
