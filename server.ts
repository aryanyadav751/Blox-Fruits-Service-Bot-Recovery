import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbRepository } from './src/db/index.ts';
import { 
  toHundredths, 
  calculateDepositAndRemaining, 
  generatePublicToken 
} from './src/lib/calculator.ts';
import { 
  verifyAdminPassword, 
  createStaffSessionToken, 
  verifyStaffSessionToken 
} from './src/lib/auth.ts';
import {
  isStorageConfigured,
  getStorageBucketName,
  generateUploadPresignedUrl,
  generateDownloadPresignedUrl,
  validateMediaUpload,
} from './src/lib/storage.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

function resolvePort(): number {
  const portArgIndex = process.argv.findIndex((arg) => arg === '--port' || arg === '-p');
  if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
    const parsed = parseInt(process.argv[portArgIndex + 1], 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  if (process.env.PORT) {
    const parsed = parseInt(process.env.PORT, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3000;
}

const port = resolvePort();

app.use(express.json());

// In-memory rate limiting for order submissions and admin login
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxRequests = 15, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count++;
  return true;
}

// Clean up stale rate limits periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) rateLimitMap.delete(key);
  }
}, 300000);

// --- PUBLIC API ROUTES ---

// 1. Get published services catalog
app.get('/api/services', (_req, res) => {
  try {
    const published = dbRepository.getServices({ onlyPublished: true });
    res.json({ success: true, services: published });
  } catch (err: any) {
    console.error('Error fetching services:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve catalog' });
  }
});

// 2. Get single published service by slug or ID
app.get('/api/services/:identifier', (req, res) => {
  try {
    const { identifier } = req.params;
    let service = dbRepository.getServiceBySlug(identifier);
    if (!service) {
      service = dbRepository.getServiceById(identifier);
    }

    if (!service || !service.isPublished) {
      return res.status(404).json({ success: false, error: 'Service not found or unpublished' });
    }

    res.json({ success: true, service });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Error fetching service' });
  }
});

// 3. Create Order
app.post('/api/orders', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip, 10, 60000)) {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many requests. Please wait a minute before submitting again.' 
    });
  }

  try {
    const {
      serviceId,
      robloxUsername,
      timezone,
      availability,
      paymentType,
      items,
      customerNote,
      consentPublicProofs,
    } = req.body;

    // Validation
    if (!serviceId || !robloxUsername || !timezone || !availability || !paymentType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required order details (service, Roblox username, timezone, availability, payment type).' 
      });
    }

    // Verify service exists and is strictly PUBLISHED
    const service = dbRepository.getServiceById(serviceId);
    if (!service || !service.isPublished) {
      return res.status(400).json({ 
        success: false, 
        error: 'The requested service is not currently available for ordering.' 
      });
    }

    // Sanitize username (alphanumeric + underscore only, standard Roblox username rule)
    const cleanUsername = String(robloxUsername).trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Roblox username format. Usernames contain 3-20 letters, numbers, or underscores.' 
      });
    }

    // Validate offered items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'At least one fruit or gamepass must be offered for payment.' 
      });
    }

    const orderItemsData = items.map((item: any) => {
      const name = String(item.itemName || '').trim();
      const qty = Math.max(1, parseInt(item.quantity || 1, 10));
      const valM = parseFloat(item.proposedValueM || 0);
      const valHundredths = toHundredths(isNaN(valM) ? 0 : valM);

      return {
        itemName: name || 'Unnamed Item',
        quantity: qty,
        proposedValueHundredths: Math.max(0, valHundredths),
        agreedValueHundredths: null,
      };
    });

    const totalHundredths = service.priceHundredths;
    const { depositHundredths, remainingHundredths } = calculateDepositAndRemaining(totalHundredths);

    const publicToken = generatePublicToken();
    const orderCode = dbRepository.getNextOrderCode();

    const { order, items: createdItems } = dbRepository.createOrder(
      {
        publicToken,
        orderCode,
        serviceId: service.id,
        robloxUsername: cleanUsername,
        timezone: String(timezone).trim(),
        availability: String(availability).trim(),
        paymentType: ['fruits', 'gamepass', 'combination'].includes(paymentType) ? paymentType : 'combination',
        status: 'pending_review',
        totalPriceHundredths: totalHundredths,
        depositHundredths,
        remainingHundredths,
        customerNote: customerNote ? String(customerNote).trim().slice(0, 500) : null,
        staffNotes: null,
        consentPublicProofs: Boolean(consentPublicProofs),
      },
      orderItemsData
    );

    return res.status(201).json({
      success: true,
      orderCode: order.orderCode,
      publicToken: order.publicToken,
      orderId: order.id,
      serviceName: service.name,
      totalPriceM: (order.totalPriceHundredths / 100).toFixed(2),
      depositM: (order.depositHundredths / 100).toFixed(2),
      remainingM: (order.remainingHundredths / 100).toFixed(2),
    });
  } catch (err: any) {
    console.error('Error creating order:', err);
    return res.status(500).json({ success: false, error: 'Internal server error while processing order' });
  }
});

// 4. Public Order Status by unguessable public_token
app.get('/api/orders/track/:token', (req, res) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 16) {
      return res.status(400).json({ success: false, error: 'Invalid tracking token' });
    }

    const order = dbRepository.getOrderByPublicToken(token);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found. Please check your tracking link.' });
    }

    const service = dbRepository.getServiceById(order.serviceId);
    const items = dbRepository.getOrderItems(order.id);
    const auditLogs = dbRepository.getOrderAuditLogs(order.id);
    const payments = dbRepository.getOrderPayments(order.id);

    // Filter audit logs for customer view (strip sensitive internal staff notes)
    const publicTimeline = auditLogs.map(log => ({
      action: log.action,
      note: log.note,
      createdAt: log.createdAt,
      actor: log.actor === 'staff' ? 'Staff Member' : 'System',
    }));

    // Customer safe representation (no passwords, no raw staff-only fields)
    res.json({
      success: true,
      order: {
        orderCode: order.orderCode,
        publicToken: order.publicToken,
        serviceName: service ? service.name : 'Blox Fruit Service',
        serviceCategory: service ? service.category : 'General',
        robloxUsername: order.robloxUsername,
        timezone: order.timezone,
        availability: order.availability,
        paymentType: order.paymentType,
        status: order.status,
        totalPriceM: (order.totalPriceHundredths / 100).toFixed(2),
        depositM: (order.depositHundredths / 100).toFixed(2),
        remainingM: (order.remainingHundredths / 100).toFixed(2),
        customerNote: order.customerNote,
        consentPublicProofs: order.consentPublicProofs,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: items.map(i => ({
          itemName: i.itemName,
          quantity: i.quantity,
          proposedValueM: (i.proposedValueHundredths / 100).toFixed(2),
          agreedValueM: i.agreedValueHundredths !== null && i.agreedValueHundredths !== undefined
            ? (i.agreedValueHundredths / 100).toFixed(2)
            : null,
          verified: i.verified,
        })),
        payments: payments.map(p => ({
          kind: p.kind,
          amountM: (p.amountHundredths / 100).toFixed(2),
          recordedAt: p.recordedAt,
        })),
        timeline: publicTimeline,
      }
    });
  } catch (err: any) {
    console.error('Error tracking order:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve order status' });
  }
});

// 5. Submit Customer Support Enquiry
app.post('/api/support/enquiries', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(`enquiry_${ip}`, 8, 60000)) {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many requests. Please wait a minute before submitting another enquiry.' 
    });
  }

  try {
    const { robloxUsername, customerName, discordTag, orderCodeOrId, subject, message } = req.body;
    if (!robloxUsername || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Roblox username, subject, and message are required.' 
      });
    }

    const cleanUsername = String(robloxUsername).trim();
    const cleanSubject = String(subject).trim().slice(0, 150);
    const cleanMessage = String(message).trim().slice(0, 2000);

    const enquiry = dbRepository.createEnquiry({
      source: 'website',
      customerName: customerName ? String(customerName).trim().slice(0, 100) : null,
      robloxUsername: cleanUsername,
      discordTag: discordTag ? String(discordTag).trim().slice(0, 100) : null,
      orderCodeOrId: orderCodeOrId ? String(orderCodeOrId).trim().toUpperCase() : null,
      subject: cleanSubject,
      message: cleanMessage,
      status: 'pending',
      staffNotes: null,
    });

    res.status(201).json({ 
      success: true, 
      enquiryId: enquiry.id, 
      message: 'Support enquiry submitted. Our staff will review it shortly!' 
    });
  } catch (err: any) {
    console.error('Submit enquiry error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit enquiry' });
  }
});

// 6. Public Proofs Showcase (Strictly Customer Consented + Staff Approved)
app.get('/api/proofs', async (_req, res) => {
  try {
    const proofs = dbRepository.getPublicProofs();

    // If evidence points to an S3 object key and storage is configured,
    // generate a presigned download URL for viewing so private bucket objects can be displayed safely
    const enriched = await Promise.all(
      proofs.map(async (p) => {
        if (p.mediaUrl && p.mediaUrl.startsWith('evidence/') && isStorageConfigured()) {
          try {
            const presignedUrl = await generateDownloadPresignedUrl(p.mediaUrl, 3600);
            return { ...p, mediaUrl: presignedUrl, storageKey: p.mediaUrl };
          } catch (e) {
            console.error('Failed presigning mediaUrl for proof:', p.id, e);
          }
        }
        return p;
      })
    );

    res.json({ success: true, proofs: enriched });
  } catch (err: any) {
    console.error('Error fetching proofs:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch public proofs' });
  }
});

// 7. Ongoing Services (Active Carries Queue - Privacy Masked unless consented)
app.get('/api/ongoing', (_req, res) => {
  try {
    const activeCarries = dbRepository.getOngoingCarries();
    res.json({ success: true, activeCarries });
  } catch (err: any) {
    console.error('Error fetching ongoing carries:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch ongoing carries' });
  }
});

// 8. Generate Presigned Upload URL for Screenshots and Videos
// Keeps customer uploads private by default in 'blox-fruit-services-media'
app.post('/api/storage/presigned-upload', async (req, res) => {
  try {
    const staffToken = extractStaffToken(req);
    const staffSession = staffToken ? verifyStaffSessionToken(staffToken) : null;

    const { orderId, publicToken, filename, contentType } = req.body;

    if (!filename || !contentType) {
      return res.status(400).json({ success: false, error: 'filename and contentType are required' });
    }

    // Permission check: Must be authenticated staff OR customer with valid publicToken matching the order
    if (!staffSession) {
      if (!publicToken || !orderId) {
        return res.status(401).json({ 
          success: false, 
          error: 'Unauthorized: Staff session or order public tracking token required to request upload URL' 
        });
      }
      const order = dbRepository.getOrderById(orderId);
      if (!order || order.publicToken !== publicToken) {
        return res.status(403).json({ success: false, error: 'Forbidden: Invalid order tracking token' });
      }
    }

    const validation = validateMediaUpload(filename, contentType);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const result = await generateUploadPresignedUrl({
      orderId,
      filename,
      contentType,
      expiresInSeconds: 900,
    });

    res.json({
      success: true,
      uploadUrl: result.uploadUrl,
      fileKey: result.fileKey,
      bucket: result.bucket,
      expiresIn: result.expiresIn,
    });
  } catch (err: any) {
    console.error('Error generating presigned upload URL:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Failed to generate presigned upload URL' 
    });
  }
});

// 9. Generate Presigned Download URL for Private Media Access
app.get('/api/storage/presigned-download', async (req, res) => {
  try {
    const { key, publicToken } = req.query;
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ success: false, error: 'File key is required' });
    }

    const staffToken = extractStaffToken(req);
    const staffSession = staffToken ? verifyStaffSessionToken(staffToken) : null;

    // Check permissions: Staff can view all evidence;
    // Customer can view if publicToken matches the order referenced in key;
    // Or if the evidence has public approval and customer consent.
    let isAuthorized = Boolean(staffSession);

    if (!isAuthorized) {
      const allEvidence = dbRepository.listEvidence({ isCompleted: true, staffApprovedPublic: true });
      const publicItem = allEvidence.find(e => e.mediaUrl === key && e.customerConsentPublic);
      if (publicItem) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && publicToken && typeof publicToken === 'string') {
      const order = dbRepository.getOrderByPublicToken(publicToken);
      if (order && key.includes(`/${order.id}/`)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ 
        success: false, 
        error: 'Forbidden: You do not have permission to access this private media' 
      });
    }

    const downloadUrl = await generateDownloadPresignedUrl(key, 3600);
    res.json({ success: true, downloadUrl });
  } catch (err: any) {
    console.error('Error generating presigned download URL:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Failed to generate download URL' 
    });
  }
});

// --- STAFF ADMIN AUTHENTICATION & API ROUTES ---

// Helper to extract session token from Authorization header or cookie
function extractStaffToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/bfs_staff_session=([^;]+)/);
    if (match) return match[1];
  }
  return null;
}

// Middleware: Require valid staff session
function requireStaffAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = extractStaffToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Staff session required' });
  }

  const session = verifyStaffSessionToken(token);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Session expired or invalid. Please log in again.' });
  }

  (req as any).staffSession = session;
  next();
}

// 1. Staff Login
app.post('/api/admin/login', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.toString() || req.socket.remoteAddress || 'unknown';
  // Strict rate limit on staff login: max 5 attempts per minute
  if (!checkRateLimit(`login_${ip}`, 5, 60000)) {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many failed login attempts. Please wait 60 seconds.' 
    });
  }

  const { password } = req.body;
  if (!password || !verifyAdminPassword(password)) {
    return res.status(401).json({ success: false, error: 'Invalid staff admin password' });
  }

  const token = createStaffSessionToken('staff_operator');
  // Set HTTP-only secure cookie
  res.setHeader(
    'Set-Cookie',
    `bfs_staff_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );

  return res.json({
    success: true,
    token,
    role: 'staff',
    message: 'Staff authentication successful',
  });
});

// 2. Staff Logout
app.post('/api/admin/logout', (_req, res) => {
  res.setHeader(
    'Set-Cookie',
    'bfs_staff_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  );
  res.json({ success: true, message: 'Logged out successfully' });
});

// 3. Verify Current Session
app.get('/api/admin/me', requireStaffAuth, (req, res) => {
  const session = (req as any).staffSession;
  res.json({ success: true, staffId: session.staffId, role: session.role });
});

// 4. List All Orders for Staff Dashboard
app.get('/api/admin/orders', requireStaffAuth, (req, res) => {
  try {
    const status = req.query.status?.toString();
    const search = req.query.search?.toString();

    const orders = dbRepository.listOrders({ status, search });
    
    // Enrich orders with service name and payment totals
    const enriched = orders.map(o => {
      const service = dbRepository.getServiceById(o.serviceId);
      const payments = dbRepository.getOrderPayments(o.id);
      const totalPaidHundredths = payments.reduce((sum, p) => sum + p.amountHundredths, 0);

      return {
        id: o.id,
        orderCode: o.orderCode,
        publicToken: o.publicToken,
        serviceId: o.serviceId,
        serviceName: service ? service.name : 'Unknown Service',
        serviceCategory: service ? service.category : 'General',
        robloxUsername: o.robloxUsername,
        timezone: o.timezone,
        availability: o.availability,
        paymentType: o.paymentType,
        status: o.status,
        totalPriceM: (o.totalPriceHundredths / 100).toFixed(2),
        depositM: (o.depositHundredths / 100).toFixed(2),
        remainingM: (o.remainingHundredths / 100).toFixed(2),
        totalPaidM: (totalPaidHundredths / 100).toFixed(2),
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      };
    });

    res.json({ success: true, orders: enriched });
  } catch (err: any) {
    console.error('Admin list orders error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch admin orders' });
  }
});

// 5. Get Single Order Detail with Audit Logs and Payments
app.get('/api/admin/orders/:id', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    let order = dbRepository.getOrderById(id);
    if (!order) {
      order = dbRepository.getOrderByCode(id);
    }

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const service = dbRepository.getServiceById(order.serviceId);
    const items = dbRepository.getOrderItems(order.id);
    const auditLogs = dbRepository.getOrderAuditLogs(order.id);
    const payments = dbRepository.getOrderPayments(order.id);

    res.json({
      success: true,
      order: {
        id: order.id,
        orderCode: order.orderCode,
        publicToken: order.publicToken,
        serviceId: order.serviceId,
        serviceName: service ? service.name : 'Unknown Service',
        serviceCategory: service ? service.category : 'General',
        servicePriceM: service ? service.priceM : '0.00',
        robloxUsername: order.robloxUsername,
        timezone: order.timezone,
        availability: order.availability,
        paymentType: order.paymentType,
        status: order.status,
        totalPriceM: (order.totalPriceHundredths / 100).toFixed(2),
        depositM: (order.depositHundredths / 100).toFixed(2),
        remainingM: (order.remainingHundredths / 100).toFixed(2),
        customerNote: order.customerNote,
        staffNotes: order.staffNotes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: items.map(i => ({
          id: i.id,
          itemName: i.itemName,
          quantity: i.quantity,
          proposedValueM: (i.proposedValueHundredths / 100).toFixed(2),
          agreedValueM: i.agreedValueHundredths !== null && i.agreedValueHundredths !== undefined
            ? (i.agreedValueHundredths / 100).toFixed(2)
            : null,
          verified: i.verified,
        })),
        payments: payments.map(p => ({
          id: p.id,
          kind: p.kind,
          amountM: (p.amountHundredths / 100).toFixed(2),
          itemsJson: p.itemsJson,
          recordedBy: p.recordedBy,
          recordedAt: p.recordedAt,
        })),
        auditLogs,
      }
    });
  } catch (err: any) {
    console.error('Admin get order detail error:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve order details' });
  }
});

// 6. Update Order Status (Staff Action)
app.post('/api/admin/orders/:id/status', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const validStatuses = [
      'pending_review',
      'accepted',
      'more_info_needed',
      'deposit_received',
      'in_progress',
      'completed',
      'fully_paid',
      'rejected',
      'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid order status specified' });
    }

    const order = dbRepository.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const updated = dbRepository.updateOrderStatus(id, status, 'staff', note);
    res.json({ success: true, order: updated });
  } catch (err: any) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, error: 'Failed to update order status' });
  }
});

// 7. Staff Item Valuation & Verification Action
app.post('/api/admin/orders/:id/items/:itemId', requireStaffAuth, (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { agreedValueM, verified } = req.body;

    const valHundredths = agreedValueM !== undefined && agreedValueM !== null
      ? toHundredths(agreedValueM)
      : null;

    const updatedItem = dbRepository.updateOrderItem(itemId, {
      agreedValueHundredths: valHundredths,
      verified: Boolean(verified),
    });

    if (!updatedItem) {
      return res.status(404).json({ success: false, error: 'Order item not found' });
    }

    dbRepository.addAuditLog(
      id,
      'staff',
      'ITEM_VALUATION_CONFIRMED',
      `Staff verified "${updatedItem.itemName}". Agreed value: ${(updatedItem.agreedValueHundredths || 0) / 100}M. Verified: ${updatedItem.verified}`
    );

    res.json({ success: true, item: updatedItem });
  } catch (err: any) {
    console.error('Item update error:', err);
    res.status(500).json({ success: false, error: 'Failed to update item valuation' });
  }
});

// 8. Record In-Game Trade Payment (Deposit or Remaining)
// RULE: The site must NEVER mark a payment as received automatically.
// Only an authenticated staff member can record a payment as received.
app.post('/api/admin/orders/:id/payments', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { kind, amountM, itemsJson, staffName } = req.body;

    if (!['deposit', 'remaining'].includes(kind)) {
      return res.status(400).json({ success: false, error: 'Payment kind must be "deposit" or "remaining"' });
    }

    const order = dbRepository.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const amountHundredths = toHundredths(amountM);
    if (amountHundredths <= 0) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than 0M' });
    }

    const recordedBy = staffName ? String(staffName).trim() : 'Staff Member';
    const payment = dbRepository.recordPayment(
      id,
      kind,
      amountHundredths,
      itemsJson || '[]',
      recordedBy
    );

    // Update order status: deposit -> deposit_received, remaining -> fully_paid
    if (kind === 'deposit') {
      dbRepository.updateOrderStatus(id, 'deposit_received', 'staff', `50% deposit (${amountM}M) received in-game by ${recordedBy}`);
    } else if (kind === 'remaining') {
      dbRepository.updateOrderStatus(id, 'fully_paid', 'staff', `Remaining balance (${amountM}M) received in-game by ${recordedBy}`);
    }

    res.json({ success: true, payment, updatedStatus: kind === 'deposit' ? 'deposit_received' : 'fully_paid' });
  } catch (err: any) {
    console.error('Record payment error:', err);
    res.status(500).json({ success: false, error: 'Failed to record payment' });
  }
});

// 9. Update Internal Staff Notes
app.post('/api/admin/orders/:id/notes', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { staffNotes } = req.body;

    const updated = dbRepository.updateOrderStaffNotes(id, String(staffNotes || ''));
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    dbRepository.addAuditLog(id, 'staff', 'STAFF_NOTES_UPDATED', 'Staff updated internal notes');
    res.json({ success: true, order: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update staff notes' });
  }
});

// 10. Admin Catalog API (CRUD) for Stage 4
app.get('/api/admin/catalog', requireStaffAuth, (_req, res) => {
  try {
    const all = dbRepository.getServices();
    res.json({ success: true, services: all });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch catalog' });
  }
});

app.post('/api/admin/catalog', requireStaffAuth, (req, res) => {
  try {
    const { category, name, slug, description, priceM, prerequisites, exclusions, isPublished, needsConfirmation } = req.body;
    if (!category || !name || !priceM) {
      return res.status(400).json({ success: false, error: 'Category, name, and priceM are required' });
    }

    const priceHundredths = toHundredths(priceM);
    const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const newService = dbRepository.createService({
      category: String(category).trim(),
      name: String(name).trim(),
      slug: generatedSlug,
      description: String(description || '').trim(),
      priceHundredths,
      priceM: (priceHundredths / 100).toFixed(2),
      prerequisites: prerequisites ? String(prerequisites).trim() : null,
      exclusions: exclusions ? String(exclusions).trim() : null,
      isPublished: Boolean(isPublished),
      needsConfirmation: Boolean(needsConfirmation),
    });

    res.status(201).json({ success: true, service: newService });
  } catch (err: any) {
    console.error('Create service error:', err);
    res.status(500).json({ success: false, error: 'Failed to create service' });
  }
});

app.put('/api/admin/catalog/:id', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { category, name, description, priceM, prerequisites, exclusions, isPublished, needsConfirmation } = req.body;

    const updates: any = {};
    if (category !== undefined) updates.category = String(category).trim();
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (priceM !== undefined) {
      const h = toHundredths(priceM);
      updates.priceHundredths = h;
      updates.priceM = (h / 100).toFixed(2);
    }
    if (prerequisites !== undefined) updates.prerequisites = prerequisites ? String(prerequisites).trim() : null;
    if (exclusions !== undefined) updates.exclusions = exclusions ? String(exclusions).trim() : null;
    if (isPublished !== undefined) updates.isPublished = Boolean(isPublished);
    if (needsConfirmation !== undefined) updates.needsConfirmation = Boolean(needsConfirmation);

    const updated = dbRepository.updateService(id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }

    res.json({ success: true, service: updated });
  } catch (err: any) {
    console.error('Update service error:', err);
    res.status(500).json({ success: false, error: 'Failed to update service' });
  }
});

app.delete('/api/admin/catalog/:id', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const ok = dbRepository.deleteService(id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Service not found' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to delete service' });
  }
});

// 11. Staff Support Inbox: List & Search Enquiries
app.get('/api/admin/enquiries', requireStaffAuth, (req, res) => {
  try {
    const status = req.query.status?.toString();
    const search = req.query.search?.toString();
    const enquiries = dbRepository.listEnquiries({ status, search });
    res.json({ success: true, enquiries });
  } catch (err: any) {
    console.error('List enquiries error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch enquiries' });
  }
});

// 12. Staff Manual Enquiry Recording (Discord DMs / In-Game tickets)
app.post('/api/admin/enquiries', requireStaffAuth, (req, res) => {
  try {
    const { source, robloxUsername, customerName, discordTag, orderCodeOrId, subject, message, status, staffNotes } = req.body;
    if (!robloxUsername || !subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Roblox username, subject, and message are required' 
      });
    }

    const cleanUsername = String(robloxUsername).trim();
    const enquiry = dbRepository.createEnquiry({
      source: ['website', 'discord', 'direct'].includes(source) ? source : 'discord',
      customerName: customerName ? String(customerName).trim().slice(0, 100) : null,
      robloxUsername: cleanUsername,
      discordTag: discordTag ? String(discordTag).trim().slice(0, 100) : null,
      orderCodeOrId: orderCodeOrId ? String(orderCodeOrId).trim().toUpperCase() : null,
      subject: String(subject).trim().slice(0, 150),
      message: String(message).trim().slice(0, 2000),
      status: ['pending', 'in_progress', 'resolved'].includes(status) ? status : 'pending',
      staffNotes: staffNotes ? String(staffNotes).trim() : null,
    });

    res.status(201).json({ success: true, enquiry });
  } catch (err: any) {
    console.error('Record manual enquiry error:', err);
    res.status(500).json({ success: false, error: 'Failed to record manual enquiry' });
  }
});

// 13. Update Enquiry Status & Staff Notes
app.patch('/api/admin/enquiries/:id', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { status, staffNotes } = req.body;

    if (!['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const updated = dbRepository.updateEnquiryStatus(id, status, staffNotes);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Enquiry not found' });
    }

    res.json({ success: true, enquiry: updated });
  } catch (err: any) {
    console.error('Update enquiry error:', err);
    res.status(500).json({ success: false, error: 'Failed to update enquiry' });
  }
});

// 14. Record Service Evidence / Screen-Share Verification
app.post('/api/admin/orders/:id/evidence', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { evidenceType, mediaUrl, notes, customerConsentPublic, staffApprovedPublic, isOngoing, isCompleted } = req.body;

    const order = dbRepository.getOrderById(id);
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (!evidenceType || !mediaUrl) {
      return res.status(400).json({ success: false, error: 'Evidence type and media URL/link are required' });
    }

    const session = (req as any).staffSession;
    const ev = dbRepository.createEvidence({
      orderId: order.id,
      serviceId: order.serviceId,
      evidenceType: ['screenshot', 'video_link', 'screen_share_session'].includes(evidenceType) ? evidenceType : 'screenshot',
      mediaUrl: String(mediaUrl).trim(),
      notes: notes ? String(notes).trim() : null,
      customerConsentPublic: Boolean(customerConsentPublic),
      staffApprovedPublic: Boolean(staffApprovedPublic),
      isOngoing: Boolean(isOngoing),
      isCompleted: isCompleted !== undefined ? Boolean(isCompleted) : true,
      reviewedAt: staffApprovedPublic ? new Date().toISOString() : null,
      reviewedBy: staffApprovedPublic ? session.staffId : null,
    });

    dbRepository.addAuditLog(
      id,
      'staff',
      'EVIDENCE_RECORDED',
      `Evidence (${ev.evidenceType}) recorded by ${session.staffId}. Public approval: ${ev.staffApprovedPublic}`
    );

    res.status(201).json({ success: true, evidence: ev });
  } catch (err: any) {
    console.error('Attach evidence error:', err);
    res.status(500).json({ success: false, error: 'Failed to attach evidence' });
  }
});

// 15. List Evidence for an Order
app.get('/api/admin/orders/:id/evidence', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const evidence = dbRepository.getEvidenceByOrderId(id);
    res.json({ success: true, evidence });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve evidence' });
  }
});

// 16. Toggle Evidence Public Approval
app.post('/api/admin/evidence/:id/approval', requireStaffAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { staffApprovedPublic } = req.body;
    const session = (req as any).staffSession;

    const updated = dbRepository.updateEvidenceApproval(id, Boolean(staffApprovedPublic), session.staffId);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Evidence not found' });
    }

    res.json({ success: true, evidence: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update approval' });
  }
});

export { app };
export default app;

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Blox Fruit Services server listening on port ${port} (mode: ${isProd ? 'production' : 'development'})`);
  });
}

// Only start the standalone listener if not invoked as a serverless function (e.g. Vercel)
if (process.env.VERCEL !== '1') {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}
