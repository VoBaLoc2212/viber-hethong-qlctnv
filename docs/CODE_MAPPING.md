# Ánh xạ Code: Python → TypeScript

## 📊 Bảng So Sánh Tệp Tin

| Chức năng | Python | TypeScript |
|-----------|--------|-----------|
| **Type Definitions** | `modules/ai/types.py` (450+ lines) | `lib/ai/types.ts` (400+ lines) |
| **Core Service** | `lib/ai_service.py` | `lib/ai/core.ts` |
| **Permission RBAC** | `modules/ai/services/permission_validator.py` | `lib/ai/services/permission-validator.ts` |
| **Question Analysis** | `modules/ai/services/question_analyzer.py` | `lib/ai/services/question-analyzer.ts` |
| **Data Retrieval** | `modules/ai/services/data_retriever.py` | `lib/ai/services/data-retriever.ts` |
| **Data Transform** | `modules/ai/services/data_transformer.py` | `lib/ai/services/data-transformer.ts` |
| **Conversation Mgmt** | `modules/ai/services/conversation_manager.py` | `lib/ai/services/conversation-manager.ts` |
| **LLM Client** | `lib/gemini_client.py` | `lib/ai/gemini-client.ts` |
| **API Client** | `lib/api_client.py` | Built-in to DataRetriever |
| **CLI Interface** | `app/cli.py` | N/A (Web API instead) |
| **Config** | `config/settings.py` | Environment variables |

---

## 🔄 Code Logic Mapping

### 1. Types & Enums

**Python**:
```python
class UserRole(str, Enum):
    EMPLOYEE = "EMPLOYEE"
    MANAGER = "MANAGER"
    ACCOUNTANT = "ACCOUNTANT"
    FINANCE_ADMIN = "FINANCE_ADMIN"
    AUDITOR = "AUDITOR"

class QuestionIntent(str, Enum):
    SUMMARIZE = "SUMMARIZE"
    COMPARE = "COMPARE"
    # ... 4 more
```

**TypeScript**:
```typescript
export enum UserRole {
  EMPLOYEE = "EMPLOYEE",
  MANAGER = "MANAGER",
  ACCOUNTANT = "ACCOUNTANT",
  FINANCE_ADMIN = "FINANCE_ADMIN",
  AUDITOR = "AUDITOR",
}

export enum QuestionIntent {
  SUMMARIZE = "SUMMARIZE",
  COMPARE = "COMPARE",
  // ... 4 more
}
```

---

### 2. Permission Validator

**Python**:
```python
class PermissionValidator:
    def build_user_context(self, user_id, role, department_ids):
        filters = self._build_permission_filters(role, department_ids)
        return UserContext(
            user_id=user_id,
            role=role,
            department_ids=department_ids,
            filters=filters
        )
    
    def _build_permission_filters(self, role, department_ids):
        base_filters = UserFilters(...)
        
        if role == UserRole.EMPLOYEE:
            base_filters.budget_filter.departments = department_ids
            base_filters.transaction_filter.departments = department_ids
            base_filters.transaction_filter.statuses = ["EXECUTED", "APPROVED"]
```

**TypeScript**:
```typescript
export class PermissionValidator {
  buildUserContext(
    userId: string,
    role: UserRole,
    departmentIds: string[] = []
  ): UserContext {
    const filters = this.buildPermissionFilters(role, departmentIds);
    return {
      user_id: userId,
      role,
      department_ids: departmentIds,
      filters,
    };
  }

  private buildPermissionFilters(role: UserRole, departmentIds: string[]): UserFilters {
    const baseFilters: UserFilters = { ... };
    
    if (role === UserRole.EMPLOYEE) {
      baseFilters.budget_filter.departments = departmentIds;
      baseFilters.transaction_filter.departments = departmentIds;
      baseFilters.transaction_filter.statuses = ["EXECUTED", "APPROVED"];
```

**Chuyển đổi**: Camel case Python → TypeScript; Interface thay cho Pydantic model

---

### 3. Question Analyzer

**Python**:
```python
class QuestionAnalyzer:
    async def analyze(self, question: str) -> AnalyzedQuestion:
        intent_result = await self._classify_intent(question)
        entities = await self._extract_entities(question, intent_result["intent"])
        required_apis = self._get_required_apis(intent_result["intent"], entities)
        sql_patterns = self._get_relevant_sql_patterns(...)
        
        return AnalyzedQuestion(
            intent=intent_result["intent"],
            entities=entities,
            required_apis=required_apis,
            sql_patterns=sql_patterns,
            confidence=intent_result["confidence"]
        )
```

**TypeScript**:
```typescript
export class QuestionAnalyzer {
  async analyze(question: string): Promise<AnalyzedQuestion> {
    const intentResult = await this.classifyIntent(question);
    const entities = await this.extractEntities(question, intentResult.intent);
    const requiredApis = this.getRequiredApis(intentResult.intent, entities);
    const sqlPatterns = this.getRelevantSqlPatterns(...);

    return {
      intent: intentResult.intent,
      entities,
      required_apis: requiredApis,
      sql_patterns: sqlPatterns,
      confidence: intentResult.confidence,
    };
  }
```

**Chuyển đổi**: 
- `async def` → `async function`
- Dictionary `{}` → Object `{}`
- Pydantic model return → Plain object return

---

### 4. Data Retriever

**Python**:
```python
class DataRetriever:
    async def fetch_data(self, call: ApiCall, user_context, timeout=30000):
        start_time = time.time()
        
        merged_params = self._merge_params(call.params or {}, user_context.filters)
        
        headers = {
            "Content-Type": "application/json",
            "x-user-id": user_context.user_id,
            "x-user-role": user_context.role.value,
        }
        if user_context.auth_token:
            headers["Authorization"] = f"Bearer {user_context.auth_token}"
        
        response = await self.api_client.get(
            call.endpoint,
            params=merged_params,
            headers=headers,
            timeout=timeout / 1000
        )
        
        fetch_time = int((time.time() - start_time) * 1000)
        
        return RetrievedData(
            source=call.endpoint,
            data=response,
            fetch_time=fetch_time
        )
```

**TypeScript**:
```typescript
export class DataRetriever {
  async fetchData(
    call: ApiCall,
    userContext: UserContext,
    timeout: number = 30000
  ): Promise<RetrievedData> {
    const startTime = Date.now();
    
    const mergedParams = this.mergeParams(call.params || {}, userContext.filters);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-user-id": userContext.user_id,
      "x-user-role": userContext.role,
    };
    if (userContext.auth_token) {
      headers["Authorization"] = `Bearer ${userContext.auth_token}`;
    }
    
    const url = new URL(`${this.baseUrl}${call.endpoint}`);
    Object.entries(mergedParams).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)));
      } else if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
    
    const response = await fetch(url.toString(), {
      method: call.method || "GET",
      headers,
      signal: fetchTimeout.signal,
    });
    
    const fetchTime = Date.now() - startTime;
    
    return {
      source: call.endpoint,
      data: await response.json(),
      fetch_time: fetchTime,
    };
  }
```

**Chuyển đổi**:
- `time.time()` (seconds) → `Date.now()` (milliseconds)
- `aiohttp.ClientSession.get()` → `fetch()`
- f-strings → Template literals
- URL params handling khác nhau

---

### 5. Data Transformer

**Python**:
```python
class DataTransformer:
    def transform(self, data: RetrievedData) -> TransformedData:
        if data.error or data.data is None:
            return TransformedData(type="table", columns=[], rows=[])
        
        normalized = self._normalize_data(data.data)
        
        if isinstance(normalized, list):
            return self._create_table(normalized, data.source)
        elif isinstance(normalized, dict):
            return self._create_metric(normalized, data.source)
```

**TypeScript**:
```typescript
export class DataTransformer {
  transform(data: RetrievedData): TransformedData {
    if (data.error || data.data === null || data.data === undefined) {
      return { type: "table", columns: [], rows: [] };
    }

    const normalized = this.normalizeData(data.data);

    if (Array.isArray(normalized)) {
      return this.createTable(normalized, data.source);
    } else if (typeof normalized === "object") {
      return this.createMetric(normalized, data.source);
    }
```

**Chuyển đổi**:
- `isinstance(x, list)` → `Array.isArray(x)`
- `isinstance(x, dict)` → `typeof x === "object"`
- Private method `_method()` → `private method()`

---

### 6. Conversation Manager

**Python**:
```python
class ConversationManager:
    def __init__(self, db_client=None):
        self.conversations: dict[str, Conversation] = {}
        self.messages: dict[str, list[Message]] = {}
    
    async def create_conversation(self, user_id: str, title: Optional[str] = None):
        conversation_id = str(uuid.uuid4())
        now = datetime.utcnow()
        
        conversation = Conversation(
            id=conversation_id,
            user_id=user_id,
            title=title,
            created_at=now,
            updated_at=now
        )
        
        self.conversations[conversation_id] = conversation
        self.messages[conversation_id] = []
        return conversation
```

**TypeScript**:
```typescript
export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private messages: Map<string, Message[]> = new Map();

  async createConversation(userId: string, title?: string): Promise<Conversation> {
    const conversationId = uuidv4();
    const now = new Date();

    const conversation: Conversation = {
      id: conversationId,
      user_id: userId,
      title,
      created_at: now,
      updated_at: now,
    };

    this.conversations.set(conversationId, conversation);
    this.messages.set(conversationId, []);

    return conversation;
  }
```

**Chuyển đổi**:
- `dict` → `Map<>` (type-safe)
- `datetime.utcnow()` → `new Date()`
- `uuid.uuid4()` → `uuidv4()` (từ npm package)

---

### 7. Core AI Service

**Python**:
```python
class AIService:
    async def chat(self, request: ChatRequest, user_id: str, ...):
        start_time = time.time()
        correlation_id = str(uuid.uuid4())
        
        # 1. Build user context
        user_context = self.permission_validator.build_user_context(...)
        
        # 2. Analyze question
        analysis = await self.analyzer.analyze(request.question)
        
        # 3. Retrieve data
        data_result = await self.data_retriever.aggregate_data(
            analysis.required_apis,
            user_context
        )
        
        # 4. Transform data
        table_context = ""
        for source, data in data_result["data"].items():
            normalized = self.data_retriever.normalize_response(data)
            table_context += json.dumps(normalized["items"][:5])
```

**TypeScript**:
```typescript
export class AIService {
  async chat(
    request: ChatRequest,
    userId: string,
    ...
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const correlationId = uuidv4();

    // 1. Build user context
    let userContext = this.permissionValidator.buildUserContext(...);

    // 2. Analyze question
    const analysis = await this.analyzer.analyze(request.question);

    // 3. Retrieve data
    const dataResult = await this.dataRetriever.aggregateData(
      analysis.required_apis,
      userContext
    );

    // 4. Transform data
    let tableContext = "";
    for (const [source, data] of Object.entries(dataResult.data)) {
      const normalized = this.dataRetriever.normalizeResponse(data);
      tableContext += JSON.stringify(normalized.items.slice(0, 5));
```

**Chuyển đổi**:
- `items.items()` (dict iteration) → `Object.entries()` (object iteration)
- `time.time()` → `Date.now()`
- `json.dumps()` → `JSON.stringify()`
- Kiến trúc tương tự, cú pháp khác nhau

---

## 🎯 Key Conversion Patterns

### 1. Async/Await
```python
async def func():
    result = await other_func()
```
→
```typescript
async function func() {
  const result = await otherFunc();
}
```

### 2. Type Annotations
```python
def func(x: str, y: int) -> dict:
```
→
```typescript
function func(x: string, y: number): Record<string, any> { }
```

### 3. Collections
```python
dict[str, Any]  →  Record<string, any>
list[str]       →  string[]
Optional[str]   →  string | undefined
```

### 4. String Formatting
```python
f"Value: {var}"  →  `Value: ${var}`
```

### 5. Class Methods
```python
def _private_method(self):  →  private privateMethod() {
def public_method(self):    →  publicMethod() {
```

### 6. Imports/Exports
```python
from module import Class     →  import { Class } from "./module"
```

---

## ✅ Verification Checklist

- [x] All services ported
- [x] All types converted
- [x] Async/await patterns same
- [x] RBAC logic identical
- [x] API call patterns same
- [x] Error handling preserved
- [x] Data transformation logic same
- [x] Conversation management same
- [x] LLM integration pattern same
- [x] Database integration ready

---

## 📝 Notes

1. **Python version** sử dụng Pydantic để validation, **TS version** sử dụng Zod (cho API routes)
2. **Python async** dùng `aiohttp`, **TS** dùng `fetch` API
3. **Storage**: Python dùng in-memory dict, TS dùng Map (tương tự)
4. **UUID generation**: Python `uuid.uuid4()`, TS `uuidv4()` từ npm package
5. **Date/Time**: Python `datetime.utcnow()`, TS `new Date()`
6. **JSON handling**: Python `json.dumps()`, TS `JSON.stringify()`

---

## 🚀 Cách Sử Dụng

### Python (Original)
```bash
cd "AI module"
python main.py
# Interactive CLI
```

### TypeScript (New)
```bash
# API route
POST /api/ai/chat
{
  "question": "Tóm tắt chi tiêu",
  "conversation_id": "uuid"
}
```

Cả hai đều cung cấp chức năng tương tự, nhưng TypeScript version integrate vào Next.js ecosystem.
