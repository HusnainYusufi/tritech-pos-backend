# API Examples - JWT-Based Tenant Resolution

## Complete Examples

### 1. Owner Registration

```bash
POST /t/auth/register-owner
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@acme.com",
  "password": "SecurePass123!"
}

# Response
{
  "status": 200,
  "message": "Tenant owner registered",
  "result": {
    "token": "eyJhbGc...",  # Contains tenantSlug: "acme"
    "user": {
      "_id": "65c...",
      "fullName": "John Doe",
      "email": "john@acme.com",
      "roles": ["owner"]
    }
  }
}
```

### 2. Email/Password Login

```bash
POST /t/auth/login
Content-Type: application/json

{
  "email": "manager@acme.com",
  "password": "pass123"
}

# Response
{
  "status": 200,
  "message": "Login successful",
  "result": {
    "token": "eyJhbGc...",  # Contains tenantSlug: "acme"
    "user": {
      "_id": "65c...",
      "fullName": "Manager Name",
      "email": "manager@acme.com",
      "roles": ["manager"]
    }
  }
}
```

### 3. PIN Login (Cashier)

```bash
POST /t/auth/login-pin
Content-Type: application/json

{
  "pin": "123456"
}

# Response
{
  "status": 200,
  "message": "Login successful",
  "result": {
    "token": "eyJhbGc...",  # Contains tenantSlug: "acme"
    "user": {...},
    "branchId": "65a...",
    "posId": "65b...",
    "requiresPosSelection": false,
    "availableTerminals": [...]
  }
}
```

### 4. Get Orders (Authenticated)

```bash
GET /t/pos/orders
Authorization: Bearer eyJhbGc...
# No x-tenant-id header needed!

# Response
{
  "status": 200,
  "message": "OK",
  "items": [...]
}
```

### 5. Create Order (Authenticated)

```bash
POST /t/pos/orders
Authorization: Bearer eyJhbGc...
Content-Type: application/json
# No x-tenant-id header needed!

{
  "items": [
    {
      "menuItemId": "65e...",
      "quantity": 2
    }
  ],
  "payment": {
    "method": "cash",
    "amountPaid": 50.00
  }
}

# Response
{
  "status": 201,
  "message": "Order created",
  "result": {...}
}
```

### 6. Open Till Session

```bash
POST /t/pos/till/open
Authorization: Bearer eyJhbGc...
Content-Type: application/json
# No x-tenant-id header needed!

{
  "posId": "65b...",
  "openingAmount": 100.00
}

# Response
{
  "status": 201,
  "message": "Till session opened",
  "result": {
    "token": "eyJhbGc...",  # New token with tillSessionId
    "tillSessionId": "65d...",
    "branchId": "65a...",
    "openedAt": "2024-12-26T10:00:00.000Z"
  }
}
```

### 7. Get Current User

```bash
GET /t/auth/me
Authorization: Bearer eyJhbGc...
# No x-tenant-id header needed!

# Response
{
  "status": 200,
  "message": "OK",
  "result": {
    "_id": "65c...",
    "fullName": "John Doe",
    "email": "john@acme.com",
    "roles": ["cashier"]
  }
}
```

### 8. Public Endpoints (No Auth)

```bash
# Option 1: Using x-tenant-id header
GET /t/branches?status=active
x-tenant-id: acme

# Option 2: Using subdomain
GET https://acme.yourapp.com/t/branches?status=active

# Response (both options)
{
  "status": 200,
  "message": "OK",
  "items": [
    {
      "_id": "65a...",
      "name": "Main Branch",
      "code": "main",
      "status": "active"
    }
  ]
}
```

---

## JavaScript/TypeScript Examples

### Login and Store Token

```typescript
// Login function
async function login(email: string, password: string) {
  const response = await fetch('http://localhost:3003/t/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();

  if (data.status === 200) {
    // Store token
    localStorage.setItem('authToken', data.result.token);
    return data.result;
  }

  throw new Error(data.message);
}

// Usage
try {
  const result = await login('john@acme.com', 'pass123');
  console.log('Logged in:', result.user);
} catch (error) {
  console.error('Login failed:', error.message);
}
```

### Make Authenticated Request

```typescript
// API client with automatic token injection
class APIClient {
  private baseURL = 'http://localhost:3003';

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }

  async get(endpoint: string) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: this.getHeaders()
    });
    return response.json();
  }

  async post(endpoint: string, data: any) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return response.json();
  }
}

// Usage
const api = new APIClient();

// Get orders (no tenant header needed!)
const orders = await api.get('/t/pos/orders');

// Create order (no tenant header needed!)
const newOrder = await api.post('/t/pos/orders', {
  items: [{ menuItemId: '65e...', quantity: 2 }],
  payment: { method: 'cash', amountPaid: 50.00 }
});
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Verify token and get user
      fetch('http://localhost:3003/t/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 200) {
            setUser(data.result);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await fetch('http://localhost:3003/t/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.status === 200) {
      localStorage.setItem('authToken', data.result.token);
      setUser(data.result.user);
      return data.result;
    }

    throw new Error(data.message);
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };

  return { user, loading, login, logout };
}

// Usage in component
function App() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <LoginForm onLogin={login} />;
  }

  return (
    <div>
      <h1>Welcome, {user.fullName}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

## cURL Examples

### Complete Flow

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3003/t/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@acme.com","password":"pass123"}' \
  | jq -r '.result.token')

echo "Token: $TOKEN"

# 2. Get current user
curl -X GET http://localhost:3003/t/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Get orders
curl -X GET http://localhost:3003/t/pos/orders \
  -H "Authorization: Bearer $TOKEN"

# 4. Create order
curl -X POST http://localhost:3003/t/pos/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"menuItemId": "65e...", "quantity": 2}
    ],
    "payment": {
      "method": "cash",
      "amountPaid": 50.00
    }
  }'
```

---

## Error Handling Examples

### Invalid Email Domain

```bash
POST /t/auth/login
{
  "email": "user@gmail.com",  # Generic domain, not a tenant
  "password": "pass123"
}

# Response
{
  "status": 400,
  "message": "Missing tenant identifier. Provide email, x-tenant-id header, or use tenant subdomain."
}
```

### Expired Token

```bash
GET /t/pos/orders
Authorization: Bearer <expired-token>

# Response
{
  "status": 401,
  "message": "Invalid auth token"
}
```

### Missing Token

```bash
GET /t/pos/orders
# No Authorization header

# Response
{
  "status": 401,
  "message": "Invalid auth token"
}
```

---

## Best Practices

1. **Store Token Securely:** Use `httpOnly` cookies or secure storage
2. **Handle Token Expiration:** Implement token refresh logic
3. **Email Format:** Ensure email domain matches tenant slug
4. **Error Handling:** Catch and handle authentication errors
5. **Logout:** Clear token from storage on logout

