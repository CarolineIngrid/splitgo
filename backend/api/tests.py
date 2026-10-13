from rest_framework.test import APITestCase
from django.urls import reverse


class HealthCheckTests(APITestCase):
    def test_health_check_returns_rest_response(self):
        response = self.client.get(reverse('api-health'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'ok')
        self.assertEqual(
            response.data['message'],
            'Conexão com o backend Django funcionando.',
        )

    def test_health_check_rejects_non_get_requests(self):
        response = self.client.post(reverse('api-health'))

        self.assertEqual(response.status_code, 405)
