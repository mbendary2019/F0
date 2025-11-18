import 'package:flutter/material.dart';

class PricingScreen extends StatelessWidget {
  const PricingScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Pricing | التسعير'),
        centerTitle: true,
        elevation: 0,
        backgroundColor: const Color(0xFF0F172A),
      ),
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              const Text(
                'Pro Plan',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'خطة احترافية',
                style: TextStyle(
                  fontSize: 18,
                  color: Color(0xFF94A3B8),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              // Price Card
              Container(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFF22D3EE).withOpacity(0.3),
                    width: 1,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF22D3EE).withOpacity(0.1),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    // Icon
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFF22D3EE).withOpacity(0.2),
                            const Color(0xFF3B82F6).withOpacity(0.2),
                          ],
                        ),
                        border: Border.all(
                          color: const Color(0xFF22D3EE).withOpacity(0.3),
                        ),
                      ),
                      child: const Icon(
                        Icons.bolt,
                        size: 40,
                        color: Color(0xFF22D3EE),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Price
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          '\$',
                          style: TextStyle(
                            fontSize: 24,
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '29',
                          style: TextStyle(
                            fontSize: 56,
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(width: 8),
                        Padding(
                          padding: EdgeInsets.only(top: 16),
                          child: Text(
                            '/month',
                            style: TextStyle(
                              fontSize: 16,
                              color: Color(0xFF94A3B8),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),

                    // Features
                    _buildFeature(
                      icon: Icons.stars,
                      title: '29 FZ Credits',
                      subtitle: 'رصيد 29 FZ شهرياً',
                    ),
                    const SizedBox(height: 16),
                    _buildFeature(
                      icon: Icons.psychology,
                      title: 'AI-Powered Development',
                      subtitle: 'تطوير مدعوم بالذكاء الاصطناعي',
                    ),
                    const SizedBox(height: 16),
                    _buildFeature(
                      icon: Icons.cloud_done,
                      title: 'Firebase Integration',
                      subtitle: 'تكامل Firebase',
                    ),
                    const SizedBox(height: 16),
                    _buildFeature(
                      icon: Icons.support_agent,
                      title: 'Priority Support',
                      subtitle: 'دعم ذو أولوية',
                    ),
                    const SizedBox(height: 16),
                    _buildFeature(
                      icon: Icons.payment,
                      title: 'Stripe Payments',
                      subtitle: 'مدفوعات Stripe',
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // FZ Credits Info
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF22D3EE).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0xFF22D3EE).withOpacity(0.3),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Row(
                      children: [
                        Icon(
                          Icons.info_outline,
                          size: 20,
                          color: Color(0xFF22D3EE),
                        ),
                        SizedBox(width: 8),
                        Text(
                          'FZ Credits',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF22D3EE),
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Your FZ balance recharges automatically each month. Use FZ credits to power your AI development tasks.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFFE2E8F0),
                        height: 1.5,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'رصيد FZ يتجدد تلقائياً كل شهر. استخدم رصيد FZ لتشغيل مهام التطوير بالذكاء الاصطناعي.',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFF94A3B8),
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Subscribe Button
              ElevatedButton(
                onPressed: () {
                  // TODO: Implement Stripe checkout
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Opening checkout...'),
                      duration: Duration(seconds: 2),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: const Color(0xFF22D3EE),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Subscribe Now | اشترك الآن',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),

              const SizedBox(height: 12),

              // Run F0 Task Button (Demo)
              OutlinedButton(
                onPressed: () async {
                  // TODO: Add http package to pubspec.yaml
                  // For now, just show a message
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('F0 Task: Add http package to run tasks from mobile'),
                      duration: Duration(seconds: 3),
                    ),
                  );
                  
                  /* 
                  // Uncomment when http package is added:
                  final uri = Uri.parse('http://localhost:8787/api/run');
                  final response = await http.post(
                    uri,
                    headers: {
                      'Content-Type': 'application/json',
                      'x-f0-key': '40553a48faf4ab1e9f77670df6444229535be8ff7ad4d511d3ee0d87ce1a936a',
                    },
                    body: jsonEncode({
                      'prompt': 'Hello from Flutter mobile app!',
                      'tags': ['mobile', 'flutter', 'demo'],
                    }),
                  );
                  
                  if (response.statusCode == 200) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('✅ Task started!')),
                    );
                  }
                  */
                },
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  side: const BorderSide(color: Color(0xFF22D3EE)),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  '🤖 Run F0 Task from Mobile',
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF22D3EE),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // Contact Sales
              TextButton(
                onPressed: () {
                  // TODO: Implement contact
                },
                child: const Text(
                  'Contact Sales',
                  style: TextStyle(
                    color: Color(0xFF22D3EE),
                  ),
                ),
              ),

              const SizedBox(height: 32),

              // Footer
              const Text(
                'Need more credits? Contact us for enterprise plans.',
                style: TextStyle(
                  fontSize: 12,
                  color: Color(0xFF64748B),
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              const Text(
                'تحتاج المزيد من الرصيد؟ تواصل معنا للحصول على خطط مؤسسية.',
                style: TextStyle(
                  fontSize: 11,
                  color: Color(0xFF475569),
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeature({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFF22D3EE).withOpacity(0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            icon,
            size: 20,
            color: const Color(0xFF22D3EE),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF94A3B8),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

