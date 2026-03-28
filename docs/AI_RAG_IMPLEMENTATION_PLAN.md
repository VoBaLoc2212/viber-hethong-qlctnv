# AI RAG IMPLEMENTATION PLAN

## Tổng quan hệ thống

**Mục tiêu**: Xây dựng hệ thống AI RAG (Retrieval-Augmented Generation) tích hợp vào giao diện `/ai-assistant` cho phép người dùng hỏi các câu hỏi về tài chính.

**Stack công nghệ**:
- Frontend: React/Next.js (UI `/ai-assistant/page.tsx`)
- Backend: Next.js API Routes + Middleware
- LLM: Google Gemini Flash 2.5 Pro
- Database: PostgreSQL (data retrieval)
- Vector Store: [TBD - Pinecone/Weaviate/Milvus]

---

## KIẾN TRÚC LUỒNG CHÍNH

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. QUESTION ANALYSIS LAYER                                       │
│    ├─ Parse user question                                        │
│    ├─ Extract intent & entities (Text2SQL)                       │
│    └─ Identify required API endpoints                            │
└──────────────────────────┬───────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. PERMISSION & AUTHENTICATION LAYER                             │
│    ├─ Verify JWT token                                           │
│    ├─ Check user role (RBAC)                                     │
│    ├─ Load user context (departments, budget access, etc)        │
│    └─ Build permission filters                                   │
└──────────────────────────┬───────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. DATA RETRIEVAL LAYER                                          │
│    ├─ Call relevant read-only APIs:                              │
│    │  ├─ /api/budgeting/* (Budget data)                          │
│    │  ├─ /api/transactions/* (Transaction history)               │
│    │  ├─ /api/reports/* (Aggregated data)                        │
│    │  ├─ /api/ledger/* (Ledger entries)                          │
│    │  └─ /api/controls/* (Budget control logs)                   │
│    └─ Apply permission filters                                   │
└──────────────────────────┬───────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. DATA TRANSFORMATION MIDDLEWARE                                │
│    ├─ Normalize data from multiple sources                       │
│    ├─ Apply Text2SQL transformations (raw → structured)          │
│    ├─ Convert to table-friendly format                           │
│    ├─ Add calculated fields (%, trends, anomalies)               │
│    └─ Build context for LLM (structured data summary)            │
└──────────────────────────┬───────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. RAG CONTEXT BUILDING                                          │
│    ├─ Retrieve relevant vector embeddings from store             │
│    ├─ Build knowledge context:                                   │
│    │  ├─ Historical patterns                                     │
│    │  ├─ Business rules & policies                               │
│    │  ├─ Departmental information                                │
│    │  └─ Cached aggregations                                     │
│    └─ Combine with current data                                  │
└──────────────────────────┬───────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. LLM INFERENCE (Gemini Flash 2.5 Pro)                          │
│    ├─ Build prompt with:                                         │
│    │  ├─ System policy (security, scope)                         │
│    │  ├─ Business context (rules, terminology)                   │
│    │  ├─ Retrieved data & table context                          │
│    │  └─ User question                                           │
│    ├─ Call Gemini Flash 2.5 Pro API                              │
│    └─ Extract answer + citations                                 │
└──────────────────────────┬───────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────────┐
│ 7. RESPONSE FORMATTING & PRESENTATION                            │
│    ├─ Format answer for UI                                       │
│    ├─ Add table data (if applicable)                             │
│    ├─ Include citations & sources                                │
│    ├─ Add confidence score                                       │
│    └─ Return to frontend                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## CHI TIẾT CÁC LAYER

### 1. QUESTION ANALYSIS LAYER

**Vị trí**: `src/modules/ai/services/questionAnalyzer.ts`

**Chức năng**:
- Parse user question để extract:
  - **Intent**: "summarize" | "compare" | "forecast" | "anomaly_detect" | "clarify"
  - **Entities**: time_range, department, category, user_type
  - **SQL operations**: (Text2SQL) tạo candidate SQL queries
  - **Required APIs**: endpoints cần call

**Input**:
```typescript
{
  question: "Tại sao chi phí marketing tháng này cao hơn bình thường?",
  userId: string,
  conversationId: string,
  context?: { departmentId?, categoryId? }
}
```

**Output**:
```typescript
{
  intent: "anomaly_detect",
  entities: {
    category: "marketing",
    timeRange: { start: "2026-03-01", end: "2026-03-31" },
    comparedTo: "average_last_3_months"
  },
  requiredApis: [
    { endpoint: "/api/transactions", params: { category: "marketing", month: "2026-03" } },
    { endpoint: "/api/reports/budget-vs-actual", params: { category: "marketing" } }
  ],
  sqlPatterns: [
    "SELECT SUM(amount) FROM transactions WHERE category='marketing' AND date >= ? AND date <= ?",
    "SELECT * FROM budget_control_logs WHERE category='marketing' AND anomaly_detected=true"
  ]
}
```

---

### 2. PERMISSION & AUTHENTICATION LAYER

**Vị trí**: `src/modules/ai/services/permissionValidator.ts`

**Chức năng**:
- Validate JWT token
- Load user role & department
- Build permission filters dựa trên:
  - User role (EMPLOYEE, MANAGER, ACCOUNTANT, FINANCE_ADMIN, AUDITOR)
  - Department assignment
  - Budget access list

**Quy tắc**:
| Role | Can see | Detail |
|------|---------|--------|
| **EMPLOYEE** | Own requests, own dept budget | Read-only |
| **MANAGER** | Own dept + direct reports | Can see approval workflow |
| **ACCOUNTANT** | All transactions, all cashbook | Reconciliation access |
| **FINANCE_ADMIN** | Everything | Full business view |
| **AUDITOR** | All + immutable ledger | Audit trail only |

**Middleware Output**:
```typescript
{
  userId: string,
  role: UserRole,
  department: string,
  departmentIds: string[], // owned departments
  filters: {
    budgetFilter: { departments: [...], categories: [...] },
    transactionFilter: { departments: [...], statuses: [...] },
    readOnlyMode: true
  }
}
```

---

### 3. DATA RETRIEVAL LAYER

**Vị trí**: `src/modules/ai/services/dataRetriever.ts`

**Chức năng**: Gọi các API và aggregate dữ liệu

**Read-only APIs** (không write):
```
GET /api/budgeting/budgets
GET /api/budgeting/budgets/{id}/details
GET /api/transactions  
GET /api/transactions/summary
GET /api/reports/budget-vs-actual
GET /api/reports/cashflow-forecast
GET /api/reports/expense-breakdown
GET /api/ledger/entries
GET /api/controls/alerts
GET /api/approvals/history
```

**Example - Fetch transaction data**:
```typescript
async function getTransactionData(
  filters: TransactionQueryFilter,
  userContext: UserContext
): Promise<TransactionDataSet> {
  // Apply permission filters
  const permittedFilters = mergeFilters(filters, userContext.filters);
  
  // Call API with filters
  const response = await fetch(`/api/transactions?${new URLSearchParams(permittedFilters)}`);
  return response.json();
}
```

---

### 4. DATA TRANSFORMATION MIDDLEWARE

**Vị trí**: `src/modules/ai/services/dataTransformer.ts`

**Chức năng**:
- Normalize dữ liệu từ nhiều source
- Convert raw data → structured table format
- Apply Text2SQL rules
- Calculate derived fields

**Transformations**:

| Raw → Transformed | Rule | Example |
|------------------|------|---------|
| Multiple transaction entries | Aggregate by category/time | 10 rows → 5 categories |
| Decimal amounts | Format with currency | `15000000` → `15,000,000 VND` |
| Budget numeric fields | Add variance calculation | `used: 800, reserved: 100, available: 100` → `% used: 80%, % available: 10%` |
| Date strings | Convert to relative time | `2026-03-15` → `March 15 (11 days ago)` |
| Anomalies | Flag outliers | `amount > avg + 2*stddev` → `⚠️ ANOMALY` |

**Complex Transformation Example**:
```typescript
interface RawBudgetData {
  budgetId: string;
  amount: number;
  used: number;
  reserved: number;
}

interface TransformedBudgetTable {
  id: string;
  amount: string; // "15,000,000 VND"
  used: string; // "12,000,000 VND (80%)"
  available: string; // "3,000,000 VND (20%)"
  status: "warning" | "normal" | "critical"; // if available < 20% → warning
  trend: "📈" | "📊" | "📉";
}
```

---

### 5. RAG CONTEXT BUILDING

**Vị trí**: `src/modules/ai/services/ragContextBuilder.ts`

**Chức năng**:
- Retrieve vector embeddings từ vector store
- Build knowledge base:
  - Historical patterns
  - Business rules
  - Department profiles
  - Cached insights

**Context Types**:

```typescript
interface RAGContext {
  // 1. Current data context
  tableData: TransformedDataTable[];
  temporalContext: {
    currentMonth: string;
    lastMonthAverage: number;
    quarterAverage: number;
  };
  
  // 2. Historical context (from vector store)
  similarPastQuestions: {
    question: string;
    answer: string;
    relevance: number;
  }[];
  
  // 3. Business context
  businessRules: {
    budgetPolicy: string;
    approvalThresholds: Record<string, number>;
    complianceRules: string[];
  };
  
  // 4. Department context
  departmentProfiles: {
    name: string;
    budget: number;
    headcount: number;
    averageSpend: number;
  }[];
}
```

**Vector Store Strategy**:
- **Store**: Embeddings của previous Q&A, business rules, patterns
- **Retrieve**: Similar questions using cosine similarity
- **Update**: Add new interactions to vector DB after each Q&A

---

### 6. LLM INFERENCE

**Vị trí**: `src/modules/ai/services/geminiClient.ts`

**Model**: `gemini-2.5-flash` (hoặc `gemini-2.5-pro` nếu cần)

**Prompt Template**:
```
<SYSTEM_POLICY>
You are an AI financial assistant for a corporate budget management system.
SCOPE: Read-only access. You CANNOT perform transactions or approvals.
INSTRUCTION: Provide clear, data-backed answers with citations.
</SYSTEM_POLICY>

<BUSINESS_CONTEXT>
- Budget flow: Budget → Approval → Transaction → Ledger
- Roles: Employee, Manager, Accountant, Finance_Admin, Auditor
- Data: All figures in VND
</BUSINESS_CONTEXT>

<CURRENT_DATA>
{tableData}
</CURRENT_DATA>

<SIMILAR_PAST_Q&A>
{pastContext}
</SIMILAR_PAST_Q&A>

<USER_QUESTION>
{question}
</USER_QUESTION>

<REQUIREMENTS>
- Answer in Vietnamese
- Use table data as primary source
- If data incomplete, say explicitly
- Format numbers with thousand separators
- Cite sources (e.g., "from Q1 report")
```

**Function Calling** (optional):
```typescript
const tools = [
  {
    name: "search_historical_data",
    description: "Search past transactions or reports",
    parameters: { query: string, timeRange: string }
  },
  {
    name: "calculate_metrics",
    description: "Calculate financial metrics",
    parameters: { metric: string, params: object }
  }
];
```

---

### 7. RESPONSE FORMATTING

**Vị trí**: `src/modules/ai/services/responseFormatter.ts`

**Output Format**:
```typescript
interface AIResponse {
  id: string;
  conversationId: string;
  question: string;
  
  // Main response
  answer: string;
  
  // Supporting data
  tableData?: {
    columns: ColumnDef[];
    rows: any[];
  };
  
  // Metadata
  citations: Citation[];
  confidence: number; // 0-1
  processMetadata: {
    timeMs: number;
    dataSourcesHit: string[];
    vectorsRetrieved: number;
  };
  
  // For multi-turn
  suggestedFollowUps: string[];
}

interface Citation {
  source: "report" | "ledger" | "transaction" | "budget";
  reference: { id: string; date?: string; link?: string };
}
```

---

## COMPONENT BREAKDOWN

### Frontend Components

**1. `src/app/ai-assistant/page.tsx`**
- Chat interface
- Message history
- Data table display
- Follow-up suggestions

**2. `src/components/ai/ChatContainer.tsx`**
- Message list
- Input field
- Loading states
- Error handling

**3. `src/components/ai/TableDisplay.tsx`**
- Dynamic table from response
- Sorting, filtering
- Export options

**4. `src/components/ai/CitationPanel.tsx`**
- Show sources
- Link to full reports
- Audit trail

---

### Backend Services

**1. `src/modules/ai/services/questionAnalyzer.ts`**
- Intent classification
- NLP parsing
- API endpoint mapping

**2. `src/modules/ai/services/permissionValidator.ts`**
- JWT validation
- RBAC check
- Filter builder

**3. `src/modules/ai/services/dataRetriever.ts`**
- API aggregator
- Multi-source data fetch
- Error handling & fallbacks

**4. `src/modules/ai/services/dataTransformer.ts`**
- Data normalization
- Text2SQL rules
- Calculated fields

**5. `src/modules/ai/services/ragContextBuilder.ts`**
- Vector store client
- Semantic search
- Context assembly

**6. `src/modules/ai/services/geminiClient.ts`**
- Gemini API wrapper
- Prompt building
- Tool calling orchestration

**7. `src/modules/ai/services/responseFormatter.ts`**
- Response assembly
- Citation building
- Metadata enrichment

**8. `src/modules/ai/services/conversationManager.ts`**
- Store Q&A history
- Multi-turn context
- Embedding indexing

**9. `src/modules/ai/repositories/conversationRepository.ts`**
- DB persistence for conversations
- Embedding storage

**10. `src/modules/ai/repositories/vectorStoreRepository.ts`**
- Vector store operations
- Semantic search queries

---

## API ENDPOINT - NEW

### POST `/api/ai/chat`

**Purpose**: Main chat endpoint untuk AI RAG

**Request**:
```typescript
{
  question: string;
  conversationId?: string; // for multi-turn
  context?: {
    departmentId?: string;
    categoryId?: string;
    timeRange?: { start: string; end: string };
  };
}
```

**Response**:
```typescript
{
  data: {
    id: string;
    answer: string;
    tableData?: { columns, rows };
    citations: Citation[];
    confidence: number;
    suggestedFollowUps: string[];
  },
  meta: {
    processingTimeMs: number;
    tokensUsed: number;
  }
}
```

**Status Codes**:
- `200`: Success
- `400`: Invalid question format
- `401`: Unauthorized
- `403`: Insufficient permissions
- `429`: Rate limited
- `500`: LLM error / system error

**Error Example**:
```json
{
  "code": "DATA_RETRIEVAL_FAILED",
  "message": "Failed to retrieve budget data for requested department",
  "details": { "apisFailed": ["/api/budgeting/budgets"] },
  "correlationId": "..."
}
```

---

## SECURITY CONSIDERATIONS

### Input Validation
- ✅ Sanitize user question (max 500 chars, valid UTF-8)
- ✅ Validate conversationId (UUID format)
- ✅ Validate time ranges (proper date format)

### Permission Enforcement
- ✅ Load user context via JWT
- ✅ Apply department filters to all API calls
- ✅ Block access to data outside user's scope

### Prompt Injection Prevention
- ✅ Separate user input from system prompt
- ✅ Use prompt templates (not string concat)
- ✅ Validate LLM function calls before execution
- ✅ Never expose internal API keys in prompt

### Data Privacy
- ✅ Don't log raw sensitive data
- ✅ Mask PII in responses if needed
- ✅ Audit Q&A interactions
- ✅ Compliance with data retention policies

### Rate Limiting
- ✅ Limit requests per user (e.g., 10/min)
- ✅ Limit token usage per conversation
- ✅ Cost control for LLM calls

---

## DATABASE SCHEMA ADDITIONS

### New Tables

**1. `ai_conversations`**
```sql
CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

**2. `ai_messages`**
```sql
CREATE TABLE ai_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id),
  role "user" | "assistant",
  question TEXT,
  answer TEXT,
  table_data JSONB,
  citations JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  processing_time_ms INTEGER,
  llm_model VARCHAR(50),
  tokens_used INTEGER,
  cost_estimate DECIMAL(10,6)
);
```

**3. `ai_vector_embeddings`** (if not using external vector store)
```sql
CREATE TABLE ai_vector_embeddings (
  id UUID PRIMARY KEY,
  source_type "question" | "rule" | "pattern",
  source_id VARCHAR(255),
  content TEXT,
  embedding vector(1536), -- for Gemini embeddings
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX USING ivfflat (embedding)
);
```

---

## PHASED IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)
- [ ] Split Gemini API client
- [ ] Implement questionAnalyzer (intent classification)
- [ ] Implement permissionValidator
- [ ] Create AI db schema + migrations
- [ ] Setup vector store client (choose: Pinecone/Weaviate/pgvector)
- [ ] Basic UI placeholder (input + response display)

### Phase 2: Core RAG (Week 3-4)
- [ ] Implement dataRetriever (call existing /api/*)
- [ ] Implement dataTransformer (Text2SQL rules)
- [ ] Implement ragContextBuilder
- [ ] Integration test: Question → API calls → Gemini
- [ ] UI: Add table display + citations
- [ ] Conversation persistence

### Phase 3: Advanced Features (Week 5-6)
- [ ] Multi-turn conversation context
- [ ] Vector embeddings for semantic search
- [ ] Follow-up suggestions
- [ ] Anomaly detection queries
- [ ] Export table data (CSV, PDF)
- [ ] Advanced analytics (forecasting, trends)

### Phase 4: Production Hardening (Week 7-8)
- [ ] Rate limiting + cost controls
- [ ] Security audit (prompt injection, data leaks)
- [ ] Error handling + fallbacks
- [ ] Performance optimization
- [ ] User feedback loop
- [ ] Deployment readiness

---

## TECHNOLOGY STACK DECISION

### LLM
- **Primary**: Google Gemini Flash 2.5 Pro
- **Fallback**: OpenAI GPT-4o mini
- **Reasoning**: Gemini Flash fast + cheaper for high volume

### Vector Store
**Options**:
1. **Pinecone** (Serverless, managed) ✅ Recommended
   - Pros: Easy setup, auto-scaling, cost-effective
   - Cons: Vendor lock-in
2. **pgvector** (PostgreSQL extension) 
   - Pros: No external service, integrated with DB
   - Cons: Need to manage index performance
3. **Weaviate** (Self-hosted)
   - Pros: Open-source, flexible
   - Cons: Ops overhead

**Recommendation**: Start with **Pinecone** for MVP, migrate to pgvector later if needed.

### Text2SQL
**Options**:
1. **Gemini's native function calling** ✅ Recommended
   - Use tool_choice for guaranteed SQL generation
2. **Ollama (local SQLCoder model)**
   - Pros: Local, no API cost
   - Cons: Slower inference
3. **Dedicated SQL generation API**

**Recommendation**: Use Gemini Flash function calling for simplicity.

---

## MONITORING & LOGGING

### Metrics to Track
```
- Avg response time per question
- Success rate (% questions answered well)
- API error rate breakdown
- LLM token usage & costs
- User engagement (questions/day, sessions)
- Citation accuracy (manual review)
```

### Logs Structure
```typescript
{
  timestamp: ISO-8601,
  correlationId: string,
  eventType: "question_received" | "api_called" | "llm_responded" | ...,
  userId: string,
  duration: number,
  result: "success" | "error",
  details: {
    question: string,
    apisCalled: string[],
    tokensUsed: number,
    errorCode?: string
  }
}
```

---

## SUCCESS CRITERIA

- ✅ User can ask questions in Vietnamese about their budget/transactions
- ✅ AI retrieves correct data within 3 seconds
- ✅ Confidence score > 0.8 for < 5% questions
- ✅ No data leakage (permission checks work 100%)
- ✅ Cost < $0.02 per question
- ✅ Zero prompt injection vulnerabilities
- ✅ Support 100+ concurrent users without degradation

---

## RISKS & MITIGATION

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gemini API downtime | Users can't get answers | Implement retry + queueing |
| Wrong data retrieved | Misleading answers | Add confidence scoring + manual review |
| Prompt injection | Security breach | Input validation + separate system prompt |
| Token cost explosion | Budget overrun | Set daily LLM budget limit |
| Slow API responses | Poor UX | Cache frequently asked queries |
| PII exposure in logs | Compliance violation | Sanitize log output + encryption |

---

## REFERENCES

- Business Flow: [docs/BUSINESS_FLOW.md](file:///docs/BUSINESS_FLOW.md)
- Architecture: [docs/ARCHITECTURE.md](file:///docs/ARCHITECTURE.md)
- Security: [docs/SECURITY.md](file:///docs/SECURITY.md)
- AI Rules: [docs/AI_RULES.md](file:///docs/AI_RULES.md)
- API Contract: [docs/API_CONTRACT.md](file:///docs/API_CONTRACT.md)
