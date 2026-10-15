from rest_framework.test import APIClient, APITestCase
from django.contrib.auth import get_user_model
from django.urls import reverse

from .models import Expense, ExpenseShare, Group, GroupMembership


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


class LoginRouteInspectionTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.admin = user_model.objects.create_superuser(
            email='admin@example.com',
            name='Administradora',
            password='SenhaSegura123!',
        )
        self.user = user_model.objects.create_user(
            email='user@example.com',
            name='Usuária',
            password='SenhaSegura123!',
        )
        self.url = reverse('api-login')

    def test_admin_can_inspect_login_route_in_browser(self):
        self.client.force_login(self.admin)

        response = self.client.get(self.url, HTTP_ACCEPT='text/html')

        self.assertEqual(response.status_code, 200)
        self.assertIn('text/html', response['Content-Type'])
        self.assertIn(b'name="email"', response.content)
        self.assertIn(b'name="password"', response.content)

    def test_login_route_inspection_is_not_available_to_non_admin(self):
        self.client.force_login(self.user)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_login_still_authenticates_with_post(self):
        response = self.client.post(
            self.url,
            {'email': self.admin.email, 'password': 'SenhaSegura123!'},
            format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['user']['email'], self.admin.email)

    def test_login_post_requires_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        payload = {'email': self.admin.email, 'password': 'SenhaSegura123!'}

        rejected_response = client.post(self.url, payload, format='json')
        csrf_response = client.get(reverse('api-csrf'))
        accepted_response = client.post(
            self.url,
            payload,
            format='json',
            HTTP_X_CSRFTOKEN=csrf_response.json()['csrfToken'],
        )

        self.assertEqual(rejected_response.status_code, 403)
        self.assertEqual(accepted_response.status_code, 200)


class GroupExpenseTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.payer = user_model.objects.create_user(
            email='payer@example.com',
            name='Pessoa Pagadora',
            password='SenhaSegura123!',
        )
        self.member = user_model.objects.create_user(
            email='member@example.com',
            name='Outra Pessoa',
            password='SenhaSegura123!',
        )
        self.outsider = user_model.objects.create_user(
            email='outsider@example.com',
            name='Pessoa de Fora',
            password='SenhaSegura123!',
        )
        self.group = Group.objects.create(name='Viagem', currency='BRL')
        GroupMembership.objects.create(
            group=self.group,
            user=self.payer,
            role=GroupMembership.Role.ADMIN,
        )
        GroupMembership.objects.create(group=self.group, user=self.member)
        self.client.force_authenticate(self.payer)
        self.url = reverse('api-group-expenses', args=[self.group.pk])

    def expense_payload(self, **overrides):
        payload = {
            'description': 'Hospedagem',
            'amount': '10.00',
            'paid_by': str(self.payer.pk),
            'split_type': 'equal',
            'participants': [
                {'user_id': str(self.payer.pk)},
                {'user_id': str(self.member.pk)},
            ],
        }
        payload.update(overrides)
        return payload

    def test_equal_split_saves_expense_and_shares_consistently(self):
        response = self.client.post(self.url, self.expense_payload(), format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Expense.objects.count(), 1)
        self.assertEqual(ExpenseShare.objects.count(), 2)
        self.assertEqual(
            [share['amount'] for share in response.data['participants']],
            ['5.00', '5.00'],
        )

    def test_uneven_equal_split_assigns_remaining_cent(self):
        third_member = get_user_model().objects.create_user(
            email='third@example.com',
            name='Terceira Pessoa',
            password='SenhaSegura123!',
        )
        GroupMembership.objects.create(group=self.group, user=third_member)
        payload = self.expense_payload(
            amount='10.00',
            participants=[
                {'user_id': str(self.payer.pk)},
                {'user_id': str(self.member.pk)},
                {'user_id': str(third_member.pk)},
            ],
        )

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            {
                share['user_id']: share['amount']
                for share in response.data['participants']
            },
            {
                str(self.payer.pk): '3.34',
                str(self.member.pk): '3.33',
                str(third_member.pk): '3.33',
            },
        )

    def test_amount_split_requires_shares_to_match_expense_total(self):
        payload = self.expense_payload(
            split_type='amount',
            participants=[
                {'user_id': str(self.payer.pk), 'value': '6.00'},
                {'user_id': str(self.member.pk), 'value': '4.00'},
            ],
        )

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            {
                share['user_id']: share['amount']
                for share in response.data['participants']
            },
            {
                str(self.payer.pk): '6.00',
                str(self.member.pk): '4.00',
            },
        )

    def test_percentage_split_allocates_every_cent(self):
        payload = self.expense_payload(
            split_type='percentage',
            participants=[
                {'user_id': str(self.payer.pk), 'value': '33.33'},
                {'user_id': str(self.member.pk), 'value': '66.67'},
            ],
        )

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            {
                share['user_id']: share['amount']
                for share in response.data['participants']
            },
            {
                str(self.payer.pk): '3.33',
                str(self.member.pk): '6.67',
            },
        )
        self.assertEqual(
            {
                share['user_id']: share['percentage']
                for share in response.data['participants']
            },
            {
                str(self.payer.pk): '33.33',
                str(self.member.pk): '66.67',
            },
        )

    def test_mismatched_amounts_do_not_create_expense_or_shares(self):
        payload = self.expense_payload(
            split_type='amount',
            participants=[
                {'user_id': str(self.payer.pk), 'value': '6.00'},
                {'user_id': str(self.member.pk), 'value': '3.00'},
            ],
        )

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Expense.objects.count(), 0)
        self.assertEqual(ExpenseShare.objects.count(), 0)

    def test_participant_must_belong_to_group(self):
        payload = self.expense_payload(
            participants=[{'user_id': str(self.outsider.pk)}],
        )

        response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(Expense.objects.count(), 0)

    def test_expense_list_returns_saved_shares(self):
        self.client.post(self.url, self.expense_payload(), format='json')

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(len(response.data[0]['participants']), 2)

    def test_group_members_include_user_ids_for_expense_form(self):
        response = self.client.get(reverse('api-groups'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {member['user_id'] for member in response.data[0]['members']},
            {str(self.payer.pk), str(self.member.pk)},
        )

    def test_non_member_cannot_access_group_expenses(self):
        self.client.force_authenticate(self.outsider)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 404)


class GroupPaymentTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.payer = user_model.objects.create_user(
            email='payer-payment@example.com',
            name='Pagador',
            password='SenhaSegura123!',
        )
        self.member = user_model.objects.create_user(
            email='member-payment@example.com',
            name='Recebedor',
            password='SenhaSegura123!',
        )
        self.outsider = user_model.objects.create_user(
            email='outsider-payment@example.com',
            name='Fora do Grupo',
            password='SenhaSegura123!',
        )
        self.group = Group.objects.create(name='Casa', currency='BRL')
        GroupMembership.objects.create(group=self.group, user=self.payer, role=GroupMembership.Role.ADMIN)
        GroupMembership.objects.create(group=self.group, user=self.member)
        self.client.force_authenticate(self.payer)
        self.url = reverse('api-group-payments', args=[self.group.pk])

    def test_register_payment_reduces_direct_debt(self):
        expense_url = reverse('api-group-expenses', args=[self.group.pk])
        self.client.post(
            expense_url,
            {
                'description': 'Conta de casa',
                'amount': '100.00',
                'paid_by': str(self.payer.pk),
                'split_type': 'equal',
                'participants': [
                    {'user_id': str(self.payer.pk)},
                    {'user_id': str(self.member.pk)},
                ],
            },
            format='json',
        )

        response = self.client.post(
            self.url,
            {
                'description': 'Pagamento do jantar',
                'amount': '30.00',
                'paid_by': str(self.payer.pk),
                'paid_to': str(self.member.pk),
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['amount'], '30.00')
        self.assertEqual(response.data['paid_by_id'], str(self.payer.pk))
        self.assertEqual(response.data['paid_to_id'], str(self.member.pk))

    def test_payment_cannot_exceed_current_debt(self):
        expense_url = reverse('api-group-expenses', args=[self.group.pk])
        self.client.post(
            expense_url,
            {
                'description': 'Conta de casa',
                'amount': '50.00',
                'paid_by': str(self.payer.pk),
                'split_type': 'equal',
                'participants': [
                    {'user_id': str(self.payer.pk)},
                    {'user_id': str(self.member.pk)},
                ],
            },
            format='json',
        )

        response = self.client.post(
            self.url,
            {
                'description': 'Pagamento maior',
                'amount': '100.00',
                'paid_by': str(self.payer.pk),
                'paid_to': str(self.member.pk),
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('Você só pode registrar até', response.data['amount'][0])

    def test_non_member_cannot_register_group_payment(self):
        self.client.force_authenticate(self.outsider)

        response = self.client.post(
            self.url,
            {
                'description': 'Pagamento fora do grupo',
                'amount': '10.00',
                'paid_by': str(self.payer.pk),
                'paid_to': str(self.member.pk),
            },
            format='json',
        )

        self.assertEqual(response.status_code, 404)


class GroupMemberManagementTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.member = user_model.objects.create_user(
            email='group-member@example.com',
            name='Integrante',
            password='SenhaSegura123!',
        )
        self.available_user = user_model.objects.create_user(
            email='available@example.com',
            name='Pessoa Disponível',
            password='SenhaSegura123!',
        )
        self.outsider = user_model.objects.create_user(
            email='outsider-member@example.com',
            name='Pessoa de Fora',
            password='SenhaSegura123!',
        )
        self.group = Group.objects.create(name='Casa', currency='BRL')
        GroupMembership.objects.create(
            group=self.group,
            user=self.member,
            role=GroupMembership.Role.ADMIN,
        )
        self.client.force_authenticate(self.member)
        self.url = reverse('api-group-members', args=[self.group.pk])

    def test_available_members_lists_registered_users_not_in_group(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [user['id'] for user in response.data],
            [str(self.available_user.pk), str(self.outsider.pk)],
        )
        self.assertNotIn(str(self.member.pk), [user['id'] for user in response.data])

    def test_group_member_can_add_a_registered_user(self):
        response = self.client.post(
            self.url,
            {'user_id': str(self.available_user.pk)},
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['user_id'], str(self.available_user.pk))
        self.assertEqual(
            GroupMembership.objects.filter(
                group=self.group,
                user=self.available_user,
            ).count(),
            1,
        )

    def test_adding_existing_member_does_not_create_duplicate(self):
        payload = {'user_id': str(self.member.pk)}

        first_response = self.client.post(self.url, payload, format='json')
        second_response = self.client.post(self.url, payload, format='json')

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.assertEqual(
            GroupMembership.objects.filter(group=self.group, user=self.member).count(),
            1,
        )

    def test_non_member_cannot_list_or_add_group_members(self):
        self.client.force_authenticate(self.outsider)

        list_response = self.client.get(self.url)
        add_response = self.client.post(
            self.url,
            {'user_id': str(self.available_user.pk)},
            format='json',
        )

        self.assertEqual(list_response.status_code, 404)
        self.assertEqual(add_response.status_code, 404)
