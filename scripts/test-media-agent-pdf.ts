// scripts/test-media-agent-pdf.ts
// Phase 171: Test Media Agent - PDF Analysis

import {
  analyzePDF,
  extractPDFContent,
  chunkPDFText,
  VisionRouter,
} from '../orchestrator/core/media';

/**
 * Create a minimal valid PDF for testing
 * This is a super simple PDF with "Hello World"
 */
function createTestPDF(): string {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 24 Tf
100 700 Td
(Hello World) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000260 00000 n
0000000355 00000 n
trailer
<< /Root 1 0 R /Size 6 >>
startxref
430
%%EOF`;

  return Buffer.from(pdfContent).toString('base64');
}

/**
 * Test PDF analysis
 */
async function testPDFAnalysis() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         Phase 171: Media Agent - PDF Analysis Tests           ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Check available providers
  const availableProviders = VisionRouter.getAvailableProviders();
  console.log('📡 Available providers:', availableProviders.join(', ') || 'None');

  if (availableProviders.length === 0) {
    console.log('\n❌ No vision providers configured.');
    console.log('Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_AI_API_KEY');
    process.exit(1);
  }

  // Test 1: Extract PDF content
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('🧪 Test 1: Extract PDF text content');
  console.log('─────────────────────────────────────────────────────────────────');

  const testPdfBase64 = createTestPDF();

  try {
    const extracted = await extractPDFContent({
      content: testPdfBase64,
      contentType: 'base64',
      mimeType: 'application/pdf',
      filename: 'test.pdf',
    });

    console.log('\n📊 Extraction Result:');
    console.log('  Has Text:', !!extracted.text);
    console.log('  Text Length:', extracted.text?.length || 0);
    console.log('  Page Count:', extracted.pageCount);
    console.log('  Language:', extracted.language);
    console.log('  Text Preview:', extracted.text?.substring(0, 100) || 'No text');
  } catch (error: any) {
    console.log('⚠️ PDF extraction:', error.message);
    console.log('Note: pdf-parse library may need to be installed: pnpm add -w pdf-parse');
  }

  // Test 2: Chunk text
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('🧪 Test 2: Text chunking for large documents');
  console.log('─────────────────────────────────────────────────────────────────\n');

  const longText = `This is paragraph one. It contains some important information about the topic.

This is paragraph two. It continues with more details and explanations.

This is paragraph three. Here we have conclusions and final thoughts.

This is paragraph four. Additional data and statistics are presented here.

This is paragraph five. The document ends with recommendations and next steps.`;

  const chunks = chunkPDFText(longText, 100, 20);

  console.log('Original text length:', longText.length);
  console.log('Number of chunks:', chunks.length);
  chunks.forEach((chunk, i) => {
    console.log(`\nChunk ${i + 1} (${chunk.length} chars):`);
    console.log('  "' + chunk.substring(0, 50) + '..."');
  });

  // Test 3: Analyze PDF with LLM
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('🧪 Test 3: Full PDF analysis with LLM');
  console.log('─────────────────────────────────────────────────────────────────');

  try {
    const result = await analyzePDF(
      testPdfBase64,
      'document_summary',
      'Summarize this document and list key points'
    );

    console.log('\n📊 Analysis Result:');
    console.log('  Success:', result.success);
    console.log('  Model:', result.modelUsed);
    console.log('  Provider:', result.providerUsed);
    console.log('  Description:', result.analysis.description.substring(0, 200));
    console.log('  Findings:', result.analysis.findings.slice(0, 3));
    console.log('  Confidence:', result.analysis.confidence);
    console.log('  Latency:', result.metrics.totalLatencyMs, 'ms');
    console.log('  Tokens:', result.metrics.tokens?.total);

    if (result.extracted) {
      console.log('\n📄 Extracted Content:');
      console.log('  Has Text:', result.extracted.hasText);
      console.log('  Text Length:', result.extracted.textLength);
      console.log('  Page Count:', result.extracted.pageCount);
    }

    if (result.error) {
      console.log('\n⚠️ Error:', result.error);
    }
  } catch (error: any) {
    console.log('❌ PDF analysis failed:', error.message);
  }

  // Test 4: Test different analysis intents for PDFs
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('🧪 Test 4: PDF-specific model routing');
  console.log('─────────────────────────────────────────────────────────────────\n');

  const pdfIntents = [
    'document_summary',
    'data_extraction',
    'general_description',
  ] as const;

  for (const intent of pdfIntents) {
    const routing = VisionRouter.route({
      mediaType: 'pdf',
      intent,
      userTier: 'pro',
    });

    console.log(`${intent}:`);
    console.log(`  Primary: ${routing.primaryModel} (${routing.provider})`);
    console.log(`  Fallbacks: ${routing.fallbacks.join(', ') || 'None'}`);
    console.log(`  Reason: ${routing.reason}\n`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('✅ Phase 171 PDF Analysis Tests Complete');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run tests
testPDFAnalysis().catch(console.error);
