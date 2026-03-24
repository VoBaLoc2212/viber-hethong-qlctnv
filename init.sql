-- ============================================================================
-- Budget Management System - Complete Database Schema
-- Hệ thống Quản lý Ngân sách Chi phí & Thu – Chi Nội bộ
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- ENUMS & TYPES
-- ============================================================================

CREATE TYPE user_status AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');
CREATE TYPE budget_period_type AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
CREATE TYPE budget_status AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'ACTIVE', 'CLOSED');
CREATE TYPE project_status AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE category_type AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE transaction_type AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');
CREATE TYPE approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE notification_type AS ENUM ('APPROVAL_REQUEST', 'BUDGET_ALERT', 'TRANSACTION_APPROVED', 'BUDGET_EXCEEDED', 'SYSTEM_ALERT');

-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    department_id UUID,
    status user_status DEFAULT 'ACTIVE',
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. ORGANIZATION STRUCTURE
-- ============================================================================

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    budget_allocated DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint for circular dependency
ALTER TABLE users ADD CONSTRAINT fk_users_department 
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    start_date DATE,
    end_date DATE,
    total_budget DECIMAL(15,2),
    spent_amount DECIMAL(15,2) DEFAULT 0,
    status project_status DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. CATEGORIES
-- ============================================================================

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    type category_type NOT NULL,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    icon VARCHAR(50),
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. BUDGET MANAGEMENT
-- ============================================================================

CREATE TABLE budget_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    period_type budget_period_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    status budget_status DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_period_id UUID NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    allocated_amount DECIMAL(15,2) NOT NULL,
    spent_amount DECIMAL(15,2) DEFAULT 0,
    reserved_amount DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_allocation UNIQUE (budget_period_id, department_id, category_id, project_id)
);

-- ============================================================================
-- 5. TRANSACTIONS
-- ============================================================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_code VARCHAR(100) UNIQUE NOT NULL,
    type transaction_type NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    budget_allocation_id UUID REFERENCES budget_allocations(id) ON DELETE SET NULL,

    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    notes TEXT,

    status transaction_status DEFAULT 'PENDING',
    approval_level INTEGER DEFAULT 0,
    current_approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approval_completed_at TIMESTAMP,

    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    payment_date TIMESTAMP,

    is_locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. APPROVAL WORKFLOW
-- ============================================================================

CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    approver_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    level INTEGER NOT NULL,
    status approval_status DEFAULT 'PENDING',
    comments TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. ATTACHMENTS / INVOICES
-- ============================================================================

CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(50),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. RESERVED BUDGETS / ENCUMBRANCE
-- ============================================================================

CREATE TABLE reserved_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_allocation_id UUID NOT NULL REFERENCES budget_allocations(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason TEXT NOT NULL,
    status approval_status DEFAULT 'APPROVED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- ============================================================================
-- 9. CASHBOOK (Immutable Ledger)
-- ============================================================================

CREATE TABLE cashbooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date DATE NOT NULL,
    transaction_type transaction_type NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    balance_before DECIMAL(15,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,
    description TEXT,
    reference_code VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 10. RECONCILIATION (Bank Reconciliation)
-- ============================================================================

CREATE TABLE reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reconciliation_date TIMESTAMP NOT NULL,
    system_balance DECIMAL(15,2) NOT NULL,
    actual_balance DECIMAL(15,2),
    variance DECIMAL(15,2),
    variance_reason TEXT,
    notes TEXT,
    status approval_status DEFAULT 'PENDING',
    reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reconciled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 11. RECURRING TRANSACTIONS
-- ============================================================================

CREATE TABLE recurring_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(15,2) NOT NULL,
    type transaction_type NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    frequency VARCHAR(50) NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY')),
    start_date DATE NOT NULL,
    end_date DATE,
    day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
    is_active BOOLEAN DEFAULT TRUE,
    last_generated TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 12. NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    related_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 13. AUDIT LOGS (Immutable change history)
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 14. AI CHATBOT SESSIONS
-- ============================================================================

CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'ASSISTANT')),
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_department ON users(department_id);

CREATE INDEX idx_departments_code ON departments(code);
CREATE INDEX idx_departments_parent ON departments(parent_id);
CREATE INDEX idx_departments_manager ON departments(manager_id);

CREATE INDEX idx_projects_code ON projects(code);
CREATE INDEX idx_projects_department ON projects(department_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_date_range ON projects(start_date, end_date);

CREATE INDEX idx_categories_code ON categories(code);
CREATE INDEX idx_categories_type ON categories(type);
CREATE INDEX idx_categories_parent ON categories(parent_id);

CREATE INDEX idx_budget_periods_status ON budget_periods(status);
CREATE INDEX idx_budget_periods_date_range ON budget_periods(start_date, end_date);

CREATE INDEX idx_budget_allocations_period ON budget_allocations(budget_period_id);
CREATE INDEX idx_budget_allocations_department ON budget_allocations(department_id);
CREATE INDEX idx_budget_allocations_category ON budget_allocations(category_id);
CREATE INDEX idx_budget_allocations_project ON budget_allocations(project_id);

CREATE INDEX idx_transactions_code ON transactions(transaction_code);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_department ON transactions(department_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_requester ON transactions(requester_id);
CREATE INDEX idx_transactions_approver ON transactions(current_approver_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);

CREATE INDEX idx_approval_workflows_transaction ON approval_workflows(transaction_id);
CREATE INDEX idx_approval_workflows_approver ON approval_workflows(approver_id);
CREATE INDEX idx_approval_workflows_status ON approval_workflows(status);

CREATE INDEX idx_attachments_transaction ON attachments(transaction_id);

CREATE INDEX idx_reserved_budgets_allocation ON reserved_budgets(budget_allocation_id);
CREATE INDEX idx_reserved_budgets_transaction ON reserved_budgets(transaction_id);

CREATE INDEX idx_cashbooks_date ON cashbooks(transaction_date);
CREATE INDEX idx_cashbooks_type ON cashbooks(transaction_type);
CREATE INDEX idx_cashbooks_transaction ON cashbooks(transaction_id);

CREATE INDEX idx_reconciliations_date ON reconciliations(reconciliation_date);
CREATE INDEX idx_reconciliations_status ON reconciliations(status);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================================
-- VIEWS FOR FINANCIAL REPORTING & ANALYSIS
-- ============================================================================

CREATE OR REPLACE VIEW department_budget_status AS
SELECT 
    d.id,
    d.name,
    d.code,
    ba.budget_period_id,
    ba.allocated_amount,
    ba.spent_amount,
    ba.reserved_amount,
    (ba.allocated_amount - ba.spent_amount - ba.reserved_amount) as available_amount,
    ROUND(
        ((ba.spent_amount + ba.reserved_amount) / NULLIF(ba.allocated_amount, 0)) * 100, 
        2
    ) as utilization_percentage,
    CASE 
        WHEN ROUND(((ba.spent_amount + ba.reserved_amount) / NULLIF(ba.allocated_amount, 0)) * 100, 2) >= 100 THEN 'EXCEEDED'
        WHEN ROUND(((ba.spent_amount + ba.reserved_amount) / NULLIF(ba.allocated_amount, 0)) * 100, 2) >= 80 THEN 'WARNING'
        ELSE 'NORMAL'
    END as budget_health
FROM departments d
INNER JOIN budget_allocations ba ON d.id = ba.department_id;

CREATE OR REPLACE VIEW monthly_cash_flow AS
SELECT 
    DATE_TRUNC('month', transaction_date)::DATE as month,
    SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END) as total_expense,
    SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE -amount END) as net_flow
FROM cashbooks
WHERE transaction_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', transaction_date)
ORDER BY month DESC;

CREATE OR REPLACE VIEW budget_vs_actual AS
SELECT 
    bp.id as budget_period_id,
    bp.name as period_name,
    d.name as department_name,
    cat.name as category_name,
    ba.allocated_amount,
    ba.spent_amount,
    (ba.allocated_amount - ba.spent_amount) as variance,
    ROUND(
        ((ba.allocated_amount - ba.spent_amount) / NULLIF(ba.allocated_amount, 0)) * 100,
        2
    ) as variance_percentage
FROM budget_periods bp
INNER JOIN budget_allocations ba ON bp.id = ba.budget_period_id
INNER JOIN departments d ON ba.department_id = d.id
INNER JOIN categories cat ON ba.category_id = cat.id
ORDER BY bp.start_date DESC, d.name, cat.name;

CREATE OR REPLACE VIEW pending_approvals_dashboard AS
SELECT 
    t.id,
    t.transaction_code,
    t.description,
    t.amount,
    c.name as category_name,
    d.name as department_name,
    u.full_name as requester_name,
    aw.level as approval_level,
    approver.full_name as current_approver_name,
    t.created_at
FROM transactions t
INNER JOIN categories c ON t.category_id = c.id
INNER JOIN departments d ON t.department_id = d.id
INNER JOIN users u ON t.requester_id = u.id
INNER JOIN approval_workflows aw ON t.id = aw.transaction_id
LEFT JOIN users approver ON aw.approver_id = approver.id
WHERE aw.status = 'PENDING'
ORDER BY t.created_at ASC;

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

CREATE TRIGGER trigger_update_departments_updated_at BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

CREATE TRIGGER trigger_update_projects_updated_at BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

CREATE TRIGGER trigger_update_categories_updated_at BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

CREATE TRIGGER trigger_update_budget_periods_updated_at BEFORE UPDATE ON budget_periods
FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

CREATE TRIGGER trigger_update_budget_allocations_updated_at BEFORE UPDATE ON budget_allocations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

CREATE TRIGGER trigger_update_transactions_updated_at BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

CREATE TRIGGER trigger_update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

CREATE TRIGGER trigger_update_reconciliations_updated_at BEFORE UPDATE ON reconciliations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_timestamp();

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

INSERT INTO roles (name, description, permissions) VALUES
    ('ADMIN', 'System Administrator - Full access', '{"all": ["read", "write", "delete"]}'),
    ('CFO', 'Chief Financial Officer - Budget approval', '{"budgets": ["read", "write", "approve"], "transactions": ["read", "approve"]}'),
    ('ACCOUNTANT', 'Accountant - Process payments', '{"transactions": ["read", "write", "process"], "reports": ["read"]}'),
    ('MANAGER', 'Department Manager - Budget requests', '{"budgets": ["read", "write"], "transactions": ["read", "write", "approve"]}'),
    ('EMPLOYEE', 'Employee - Submit expenses', '{"transactions": ["read", "write"], "reports": ["read"]}')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (email, full_name, password_hash, phone, status) VALUES
    ('admin@company.com', 'Admin User', '$2b$10$YourHashedPassword1', '0901234567', 'ACTIVE'),
    ('cfo@company.com', 'Nguyen Van A', '$2b$10$YourHashedPassword2', '0901234568', 'ACTIVE'),
    ('accountant@company.com', 'Tran Thi B', '$2b$10$YourHashedPassword3', '0901234569', 'ACTIVE'),
    ('manager.mkt@company.com', 'Le Van C', '$2b$10$YourHashedPassword4', '0901234570', 'ACTIVE'),
    ('employee@company.com', 'Hoang Thi E', '$2b$10$YourHashedPassword6', '0901234572', 'ACTIVE')
ON CONFLICT (email) DO NOTHING;

INSERT INTO departments (name, code, description) VALUES
    ('Marketing', 'MKT', 'Marketing Department'),
    ('Operations', 'OPS', 'Operations Department'),
    ('IT', 'IT', 'Information Technology Department'),
    ('Human Resources', 'HR', 'Human Resources Department'),
    ('Finance', 'FIN', 'Finance Department')
ON CONFLICT (code) DO NOTHING;

INSERT INTO categories (name, code, type, description) VALUES
    ('Salary', 'SAL', 'EXPENSE', 'Employee Salaries'),
    ('Office Supplies', 'VPP', 'EXPENSE', 'Văn phòng phẩm'),
    ('Office Rent', 'RENT', 'EXPENSE', 'Tiền thuê văn phòng'),
    ('Utilities', 'UTIL', 'EXPENSE', 'Điện, nước, gas'),
    ('Equipment', 'EQU', 'EXPENSE', 'Mua máy tính và thiết bị'),
    ('Travel', 'TRV', 'EXPENSE', 'Công tác/Di chuyển'),
    ('Training', 'TRN', 'EXPENSE', 'Đào tạo nhân viên'),
    ('Entertainment', 'ENT', 'EXPENSE', 'Tiếp khách/Liên hoan'),
    ('Maintenance', 'MNT', 'EXPENSE', 'Bảo trì và sửa chữa'),
    ('Professional Services', 'PROF', 'EXPENSE', 'Dịch vụ chuyên môn'),
    ('Revenue', 'REV', 'INCOME', 'Doanh thu'),
    ('Interest Income', 'INT', 'INCOME', 'Tiền lãi')
ON CONFLICT (code) DO NOTHING;

INSERT INTO projects (name, code, department_id, total_budget, status) VALUES
    ('Website Redesign', 'PROJ-WEB-2026', (SELECT id FROM departments WHERE code = 'IT'), 500000000, 'ACTIVE'),
    ('Marketing Campaign Q1', 'PROJ-MKT-Q1', (SELECT id FROM departments WHERE code = 'MKT'), 300000000, 'ACTIVE'),
    ('Office Modernization', 'PROJ-OPS-2026', (SELECT id FROM departments WHERE code = 'OPS'), 1000000000, 'PLANNING')
ON CONFLICT (code) DO NOTHING;

INSERT INTO budget_periods (name, period_type, start_date, end_date, total_amount, status, created_by) 
VALUES
    ('Q1 2026', 'QUARTERLY', '2026-01-01', '2026-03-31', 2500000000, 'ACTIVE', 
     (SELECT id FROM users WHERE email = 'admin@company.com'))
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- END OF INITIALIZATION
-- ============================================================================
