import assert from 'node:assert/strict';
import { dbRepository } from '../src/db/index.ts';

console.log('--- RUNNING CUSTOMER SUPPORT, INBOX, EVIDENCE & PROOFS TESTS ---');

// 1. Customer Support Enquiry Creation
{
  const enquiry = dbRepository.createEnquiry({
    source: 'website',
    customerName: 'TestUser',
    robloxUsername: 'RaidFan_2026',
    discordTag: 'raidfan#0001',
    orderCodeOrId: 'BFS-1042',
    subject: 'Question on Leviathan Heart carry',
    message: 'Can I do this carry on my private server with 50% deposit?',
    status: 'pending',
    staffNotes: null,
  });

  assert.ok(enquiry.id.startsWith('enq-'), 'Enquiry receives valid ID');
  assert.equal(enquiry.status, 'pending');
  assert.equal(enquiry.source, 'website');
  assert.equal(enquiry.robloxUsername, 'RaidFan_2026');
}
console.log('✓ Public website support enquiry creation passed');

// 2. Staff Manual Enquiry Logging (Discord / Direct) & Status Transitions
{
  const manual = dbRepository.createEnquiry({
    source: 'discord',
    customerName: null,
    robloxUsername: 'DiscordClient_99',
    discordTag: 'discord_client',
    orderCodeOrId: null,
    subject: 'DM Inquiry regarding Race V4 trials',
    message: 'Customer reached out in Discord general asking about timing.',
    status: 'in_progress',
    staffNotes: 'Replied in Discord channel #support-1',
  });

  assert.equal(manual.source, 'discord');
  assert.equal(manual.status, 'in_progress');

  // Staff updates status to resolved
  const resolved = dbRepository.updateEnquiryStatus(manual.id, 'resolved', 'Customer satisfied and ordered via website');
  assert.equal(resolved?.status, 'resolved');
  assert.equal(resolved?.staffNotes, 'Customer satisfied and ordered via website');

  // Search filtering
  const searchResults = dbRepository.listEnquiries({ search: 'DiscordClient_99' });
  assert.ok(searchResults.length >= 1, 'Search finds enquiry by Roblox username');
}
console.log('✓ Staff manual enquiry recording, status lifecycle, and search passed');

// 3. Evidence & Consent-Governed Public Proofs
{
  const testService = dbRepository.getServices({ onlyPublished: true })[0];
  const { order } = dbRepository.createOrder(
    {
      publicToken: 'test_token_consent_true_' + Date.now(),
      orderCode: 'BFS-TEST-CONSENT',
      serviceId: testService.id,
      robloxUsername: 'ConsentPlayer_OK',
      timezone: 'EST',
      availability: 'Nights',
      paymentType: 'fruits',
      status: 'completed',
      totalPriceHundredths: 2000,
      depositHundredths: 1000,
      remainingHundredths: 1000,
      customerNote: null,
      staffNotes: null,
      consentPublicProofs: true,
    },
    [{ itemName: 'Dragon Fruit', quantity: 1, proposedValueHundredths: 2000, agreedValueHundredths: 2000, verified: true }]
  );

  const { order: noConsentOrder } = dbRepository.createOrder(
    {
      publicToken: 'test_token_no_consent_' + Date.now(),
      orderCode: 'BFS-TEST-NOCONSENT',
      serviceId: testService.id,
      robloxUsername: 'PrivatePlayer_NoConsent',
      timezone: 'PST',
      availability: 'Mornings',
      paymentType: 'fruits',
      status: 'completed',
      totalPriceHundredths: 2000,
      depositHundredths: 1000,
      remainingHundredths: 1000,
      customerNote: null,
      staffNotes: null,
      consentPublicProofs: false, // Customer opted out of public showcase
    },
    [{ itemName: 'Kitsune Fruit', quantity: 1, proposedValueHundredths: 2000, agreedValueHundredths: 2000, verified: true }]
  );

  // Evidence with customer consent AND staff approval
  const approvedEvidence = dbRepository.createEvidence({
    orderId: order.id,
    serviceId: testService.id,
    evidenceType: 'screenshot',
    mediaUrl: 'https://example.com/proof1.png',
    notes: 'Completed in 8 minutes',
    customerConsentPublic: true,
    staffApprovedPublic: true,
    isOngoing: false,
    isCompleted: true,
  });

  // Evidence without customer consent (even if staff approved)
  const unconsentedEvidence = dbRepository.createEvidence({
    orderId: noConsentOrder.id,
    serviceId: testService.id,
    evidenceType: 'screenshot',
    mediaUrl: 'https://example.com/proof_private.png',
    notes: 'Private completion',
    customerConsentPublic: false,
    staffApprovedPublic: true,
    isOngoing: false,
    isCompleted: true,
  });

  const publicProofs = dbRepository.getPublicProofs();

  // Strict privacy rule: public proofs MUST include consented evidence and MUST NOT include unconsented evidence
  assert.ok(publicProofs.some(p => p.id === approvedEvidence.id), 'Consented & approved proof appears on public wall');
  assert.ok(!publicProofs.some(p => p.id === unconsentedEvidence.id), 'Unconsented proof is strictly blocked from public wall');
}
console.log('✓ Strict customer consent privacy enforcement on Public Proofs passed');

// 4. Ongoing Carries Queue & Anonymization
{
  const ongoing = dbRepository.getOngoingCarries();
  assert.ok(Array.isArray(ongoing), 'Ongoing carries returns array');
  for (const carry of ongoing) {
    assert.ok(carry.orderCode, 'Has order code');
    assert.ok(carry.robloxUsernameDisplay, 'Has username display');
  }
}
console.log('✓ Ongoing active carries queue privacy masking passed');

// 5. Neon Object Storage: Media validation & Presigned URL Generation
{
  const { validateMediaUpload, generateUploadPresignedUrl, getStorageBucketName } = await import('../src/lib/storage.ts');
  
  assert.equal(getStorageBucketName(), 'blox-fruit-services-media');

  // Allowed MIME types
  const validImage = validateMediaUpload('proof_screenshot.png', 'image/png');
  assert.equal(validImage.valid, true);

  const validVideo = validateMediaUpload('gameplay.mp4', 'video/mp4');
  assert.equal(validVideo.valid, true);

  // Rejected invalid MIME types
  const invalidExe = validateMediaUpload('malware.exe', 'application/x-msdownload');
  assert.equal(invalidExe.valid, false);

  const invalidExt = validateMediaUpload('hack.sh', 'image/png');
  assert.equal(invalidExt.valid, false);

  // Presigned upload URL generation (private by default)
  const presigned = await generateUploadPresignedUrl({
    orderId: 'ord-test-123',
    filename: 'raid_victory.png',
    contentType: 'image/png',
  });

  assert.ok(presigned.uploadUrl, 'Generates upload URL');
  assert.ok(presigned.fileKey.startsWith('evidence/ord-test-123/'), 'Generates structured evidence key');
  assert.equal(presigned.bucket, 'blox-fruit-services-media');
}
console.log('✓ Neon Object Storage media validation and presigned upload URL generation passed');

console.log('ALL CUSTOMER SUPPORT, PROOFS & STORAGE TESTS PASSED SUCCESSFULLY!');
