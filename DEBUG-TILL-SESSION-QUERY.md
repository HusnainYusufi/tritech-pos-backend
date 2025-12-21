# 🔍 Debug: Till Session Query

## Your Database Record:
```json
{
  "_id": "6947f07034b4704a898ed841",
  "staffId": "6928a066da028cdec305db44",
  "branchId": "6900fbcf933c89883c6d21a3",
  "posId": "69405fdcdf300666e5d9c4d1",
  "status": "open",
  "openingAmount": 567  // ← YOU SAID THIS EXISTS BUT IT'S NOT IN THE RECORD YOU SHOWED!
}
```

## Your Token Data:
```json
{
  "uid": "6928a066da028cdec305db44",
  "branchId": "6900fbcf933c89883c6d21a3",
  "posId": "69405fdcdf300666e5d9c4d1",
  "tillSessionId": null
}
```

## The Query Being Run:
```javascript
{
  staffId: "6928a066da028cdec305db44",  // ← From token uid
  branchId: "6900fbcf933c89883c6d21a3",  // ← From token branchId
  posId: "69405fdcdf300666e5d9c4d1",     // ← From token posId
  status: "open"
}
```

## ⚠️ CRITICAL ISSUE FOUND!

**Your database record is MISSING `openingAmount`!**

Look at the record you pasted - it has:
- ✅ staffId
- ✅ branchId
- ✅ posId
- ✅ status: "open"
- ❌ **NO openingAmount field!**

But you said "we have this openingAmount: 567" - **WHERE IS IT?**

## 🔧 Fix Options:

### Option 1: Update the existing record
```javascript
db.till_sessions.updateOne(
  { _id: ObjectId("6947f07034b4704a898ed841") },
  { $set: { openingAmount: 567 } }
)
```

### Option 2: Close this session and open a new one
```bash
POST /t/pos/till/close
{
  "declaredClosingAmount": 567,
  "systemClosingAmount": 567
}

# Then open new one
POST /t/pos/till/open
{
  "branchId": "6900fbcf933c89883c6d21a3",
  "posId": "69405fdcdf300666e5d9c4d1",
  "openingAmount": 567
}
```

## 🧪 Test Query Directly:

Run this in MongoDB:
```javascript
db.till_sessions.findOne({
  staffId: ObjectId("6928a066da028cdec305db44"),
  branchId: ObjectId("6900fbcf933c89883c6d21a3"),
  posId: ObjectId("69405fdcdf300666e5d9c4d1"),
  status: "open"
})
```

**Does it return the record?**
**Does it have `openingAmount: 567`?**

---

## 📋 Next Steps:

1. **Check the actual database record** - does it have `openingAmount`?
2. **Check server logs** - is the query being executed?
3. **Fix the data** - add `openingAmount` to the record
4. **Test again** - call the endpoint

Let me know what you find!
