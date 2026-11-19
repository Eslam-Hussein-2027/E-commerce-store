<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function api_requires_authentication(): void
    {
        $this->getJson('/api/products')->assertUnauthorized();
        $this->getJson('/api/dashboard')->assertUnauthorized();
    }

    #[Test]
    public function brother_can_log_in_with_session_cookie_and_log_out(): void
    {
        $user = User::factory()->create(['email' => 'ali@store.test', 'password' => 'secret123']);

        $this->withHeader('Referer', 'http://localhost/')
            ->postJson('/api/auth/login', ['email' => 'ali@store.test', 'password' => 'secret123'])
            ->assertOk()
            ->assertJsonPath('id', $user->id);

        $this->assertAuthenticatedAs($user, 'web');

        $this->withHeader('Referer', 'http://localhost/')->getJson('/api/auth/me')->assertOk()->assertJsonPath('email', 'ali@store.test');
        $this->withHeader('Referer', 'http://localhost/')->postJson('/api/auth/logout')->assertNoContent();
        $this->assertGuest('web');
    }

    #[Test]
    public function wrong_password_returns_arabic_error(): void
    {
        User::factory()->create(['email' => 'ali@store.test', 'password' => 'secret123']);

        $this->postJson('/api/auth/login', ['email' => 'ali@store.test', 'password' => 'nope'])
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }

    #[Test]
    public function validation_messages_are_in_arabic(): void
    {
        $this->actingAs(User::factory()->create());

        $this->postJson('/api/products', [])
            ->assertStatus(422)
            ->assertJsonPath('errors.name.0', 'حقل الاسم مطلوب.');
    }

    #[Test]
    public function spa_fallback_serves_non_api_paths_but_not_api(): void
    {
        $this->get('/orders/5')->assertStatus(is_file(public_path('index.html')) ? 200 : 503);
        $this->getJson('/api/does-not-exist')->assertNotFound();
    }
}
