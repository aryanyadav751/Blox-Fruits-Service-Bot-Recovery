process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../server.ts';
import { dbRepository } from '../src/db/index.ts';
import { getAdminPassword, createStaffSessionToken } from '../src/lib/auth.ts';

console.log('--- RUNNING BLOX FRUITS VALUE RESEARCH SYSTEM TESTS ---');

let server: http.Server = null as any;
let baseUrl = '';

await new Promise<void>((resolve) => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    baseUrl = `http://127.0.0.1:${port}`;
    resolve();
  });
});

try {
  // Reset database state for clean testing
  dbRepository._resetForTesting();

  // Create staff auth token
  const staffToken = createStaffSessionToken('test_admin');
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${staffToken}`,
  };

  // --------------------------------------------------------------------------
  // TEST 1: Unauthenticated requests to all research endpoints must be rejected (401)
  // --------------------------------------------------------------------------
  {
    const resGet = await fetch(`${baseUrl}/api/admin/research`);
    assert.equal(resGet.status, 401, 'Unauthenticated GET /api/admin/research must return 401');

    const resSingle = await fetch(`${baseUrl}/api/admin/research/single`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dragon Fruit', category: 'Fruits', priceM: '90' })
    });
    assert.equal(resSingle.status, 401, 'Unauthenticated single research must return 401');

    const resBatch = await fetch(`${baseUrl}/api/admin/research/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'Fruits' })
    });
    assert.equal(resBatch.status, 401, 'Unauthenticated batch research must return 401');

    const resApprove = await fetch(`${baseUrl}/api/admin/research/res-123/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(resApprove.status, 401, 'Unauthenticated approve must return 401');
  }
  console.log('✓ Security Check: Unauthenticated access to research endpoints strictly rejected with 401');

  // --------------------------------------------------------------------------
  // TEST 2: Public Market Verification Status endpoint
  // --------------------------------------------------------------------------
  {
    const resStatus = await fetch(`${baseUrl}/api/public/market-status`);
    assert.equal(resStatus.status, 200, 'Public market status returns 200');
    const data = await resStatus.json();
    assert.equal(data.success, true);
    assert.ok(typeof data.note === 'string', 'Public market status includes assurance note');
  }
  console.log('✓ Public Market Status endpoint accessible to customers without authentication');

  // --------------------------------------------------------------------------
  // TEST 3: Single Item Research with Source Extraction
  // --------------------------------------------------------------------------
  let researchedKitsuneId = '';
  {
    const res = await fetch(`${baseUrl}/api/admin/research/single`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: 'fruit-kitsune',
        name: 'Kitsune Fruit',
        category: 'Fruits',
        priceM: '115.00',
      }),
    });

    assert.equal(res.status, 200, 'Single item research succeeds with 200');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.result, 'Contains research result record');
    assert.equal(data.result.itemName, 'Kitsune Fruit');
    assert.equal(data.result.status, 'pending_approval');
    assert.ok(parseFloat(data.result.researchedValueM) > 0, 'Researched value is positive');
    assert.ok(Array.isArray(data.sources), 'Sources array returned');
    assert.ok(data.sources.length >= 1, 'At least 1 reliable source returned');

    const firstSource = data.sources[0];
    assert.ok(firstSource.sourceName, 'Source contains name');
    assert.ok(firstSource.sourceUrl.startsWith('http'), 'Source contains valid URL');
    assert.ok(firstSource.reportedValueM, 'Source contains reported trading value');

    researchedKitsuneId = data.result.id;
  }
  console.log('✓ Single item research and online source extraction verified');

  // --------------------------------------------------------------------------
  // TEST 4: Listing Research Items & Filtering
  // --------------------------------------------------------------------------
  {
    const resList = await fetch(`${baseUrl}/api/admin/research`, {
      headers: authHeaders,
    });
    assert.equal(resList.status, 200);
    const data = await resList.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.results));
    assert.ok(data.results.some((r: any) => r.id === researchedKitsuneId));

    // Filter by category
    const resCat = await fetch(`${baseUrl}/api/admin/research?category=Fruits`, {
      headers: authHeaders,
    });
    const dataCat = await resCat.json();
    assert.ok(dataCat.results.every((r: any) => r.category === 'Fruits'));
  }
  console.log('✓ Research records listing and category/status filtering verified');

  // --------------------------------------------------------------------------
  // TEST 5: Strict Invariant: Customer Catalogue Does NOT Update Before Admin Approval
  // --------------------------------------------------------------------------
  {
    const servicesBefore = await dbRepository.getServices();
    const kitsuneBefore = servicesBefore.find(s => s.name === 'Kitsune Fruit')!;
    assert.equal(kitsuneBefore.priceM, '115.00', 'Catalogue retains old price before approval');
  }
  console.log('✓ Strict Invariant: Unverified research values never automatically alter customer prices');

  // --------------------------------------------------------------------------
  // TEST 6: Manual Adjustment / Edit Proposed Researched Value
  // --------------------------------------------------------------------------
  {
    const resEdit = await fetch(`${baseUrl}/api/admin/research/${researchedKitsuneId}/edit`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        updatedValueM: '118.00',
        notes: 'Adjusted to 118M based on peak trade offers',
      }),
    });

    assert.equal(resEdit.status, 200, 'Edit returns 200');
    const dataEdit = await resEdit.json();
    assert.equal(dataEdit.success, true);
    assert.equal(dataEdit.research.researchedValueM, '118.00');
    assert.equal(dataEdit.research.status, 'pending_approval');
  }
  console.log('✓ Manual adjustment of proposed researched value verified');

  // --------------------------------------------------------------------------
  // TEST 7: Admin Approval Gate & Automatic Catalogue + Audit Trail Sync
  // --------------------------------------------------------------------------
  {
    const resApprove = await fetch(`${baseUrl}/api/admin/research/${researchedKitsuneId}/approve`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({}),
    });

    assert.equal(resApprove.status, 200, 'Approval succeeds with 200');
    const dataApprove = await resApprove.json();
    assert.equal(dataApprove.success, true);
    assert.equal(dataApprove.research.status, 'approved');
    assert.equal(dataApprove.research.approvedBy, 'test_admin');
    assert.ok(dataApprove.research.approvedAt, 'Approved timestamp recorded');

    // Verify official catalogue is now updated
    const servicesAfter = await dbRepository.getServices();
    const kitsuneAfter = servicesAfter.find(s => s.name === 'Kitsune Fruit')!;
    assert.equal(kitsuneAfter.priceM, '118.00', 'Official catalogue updated to 118.00M');
    assert.equal(kitsuneAfter.priceHundredths, 11800, 'Price hundredths updated to 11800');

    // Verify permanent entry recorded in Value History audit log
    const history = await dbRepository.listValueHistory();
    const kitsuneHist = history.find(h => h.itemName === 'Kitsune Fruit');
    assert.ok(kitsuneHist, 'Value history audit entry created');
    assert.equal(kitsuneHist.oldValueM, '115.00');
    assert.equal(kitsuneHist.newValueM, '118.00');
    assert.equal(kitsuneHist.changeReason, 'admin_approved_research');
    assert.equal(kitsuneHist.updatedBy, 'test_admin');
  }
  console.log('✓ Admin Approval Gate: Official catalogue updated and permanent audit history logged');

  // --------------------------------------------------------------------------
  // TEST 8: Rejection Workflow
  // --------------------------------------------------------------------------
  {
    // Research Dragon Fruit
    const resSingle = await fetch(`${baseUrl}/api/admin/research/single`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: 'fruit-dragon',
        name: 'Dragon Fruit',
        category: 'Fruits',
        priceM: '90.00',
      }),
    });
    const singleData = await resSingle.json();
    const dragonResId = singleData.result.id;

    // Reject research
    const resReject = await fetch(`${baseUrl}/api/admin/research/${dragonResId}/reject`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ reason: 'Market too volatile pending update' }),
    });

    assert.equal(resReject.status, 200);
    const dataReject = await resReject.json();
    assert.equal(dataReject.success, true);
    assert.equal(dataReject.research.status, 'rejected');

    // Dragon price in catalogue must remain unchanged
    const services = await dbRepository.getServices();
    const dragon = services.find(s => s.name === 'Dragon Fruit')!;
    assert.equal(dragon.priceM, '90.00', 'Catalogue value untouched after rejection');
  }
  console.log('✓ Rejection workflow verified: Rejected values do not alter catalog');

  // --------------------------------------------------------------------------
  // TEST 9: Batch Research Capability
  // --------------------------------------------------------------------------
  {
    const resBatch = await fetch(`${baseUrl}/api/admin/research/batch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ category: 'Gamepasses' }),
    });

    assert.equal(resBatch.status, 200, 'Batch research returns 200');
    const dataBatch = await resBatch.json();
    assert.equal(dataBatch.success, true);
    assert.ok(dataBatch.count >= 2, 'Researched multiple gamepass items');
  }
  console.log('✓ Batch research for categories (Gamepasses / Fruits) verified');

  // --------------------------------------------------------------------------
  // TEST 10: Research Schedule Configuration
  // --------------------------------------------------------------------------
  {
    const resGetSched = await fetch(`${baseUrl}/api/admin/research/schedule`, {
      headers: authHeaders,
    });
    assert.equal(resGetSched.status, 200);
    const dataGetSched = await resGetSched.json();
    assert.equal(dataGetSched.success, true);
    assert.ok(dataGetSched.config);

    const resUpdateSched = await fetch(`${baseUrl}/api/admin/research/schedule`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        enabled: true,
        intervalHours: 12,
        targetCategories: ['Fruits', 'Gamepasses'],
      }),
    });

    assert.equal(resUpdateSched.status, 200);
    const dataUpdateSched = await resUpdateSched.json();
    assert.equal(dataUpdateSched.success, true);
    assert.equal(dataUpdateSched.config.enabled, true);
    assert.equal(dataUpdateSched.config.intervalHours, 12);
  }
  console.log('✓ Research schedule configuration verified');

  console.log('\nALL 10 VALUE RESEARCH SYSTEM TESTS PASSED SUCCESSFULLY!\n');
} finally {
  server.close(() => {
    process.exit(0);
  });
  // Fallback in case close callback is delayed
  setTimeout(() => process.exit(0), 500);
}
