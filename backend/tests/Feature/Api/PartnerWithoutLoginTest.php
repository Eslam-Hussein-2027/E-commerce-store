<?php

namespace Tests\Feature\Api;

use App\Models\Product;
use App\Models\User;
use App\Services\DashboardService;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** One login account (إسلام) + one partner without login (محمد). */
class PartnerWithoutLoginTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function seeder_creates_one_login_and_one_partner_and_never_resets_a_changed_password(): void
    {
        $this->seed(UserSeeder::class);

        $eslam = User::where('email', 'eslam@store.local')->firstOrFail();
        $mohamed = User::where('name', 'محمد')->firstOrFail();
        $this->assertNull($mohamed->email);
        $this->assertNull($mohamed->password);

        $eslam->update(['password' => 'new-secret-123']);
        $this->seed(UserSeeder::class);

        $this->assertSame(2, User::count());
        $this->assertTrue(Hash::check('new-secret-123', $eslam->refresh()->password));
    }

    #[Test]
    public function seeder_converts_an_existing_mohamed_login_into_a_partner(): void
    {
        $old = User::factory()->create(['name' => 'محمد', 'email' => 'mohamed@store.local']);

        $this->seed(UserSeeder::class);

        $this->assertNull($old->refresh()->email);
        $this->assertSame(2, User::count());
    }

    #[Test]
    public function partner_without_login_cannot_sign_in_but_is_listed(): void
    {
        $this->seed(UserSeeder::class);

        $this->postJson('/api/auth/login', ['email' => 'mohamed@store.local', 'password' => 'password'])
            ->assertStatus(422);

        $this->actingAs(User::where('email', 'eslam@store.local')->first())
            ->getJson('/api/users')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('1.name', 'محمد')
            ->assertJsonPath('1.email', null);
    }

    #[Test]
    public function courier_chosen_on_the_order_gets_the_goods_value_in_his_custody(): void
    {
        $this->seed(UserSeeder::class);
        $eslam = User::where('email', 'eslam@store.local')->first();
        $mohamed = User::where('name', 'محمد')->first();
        $this->actingAs($eslam);

        $product = Product::factory()->create();
        $this->purchase($product, 10, 5, $eslam);

        $orderId = $this->postJson('/api/orders', [
            'customer_name' => 'سالم', 'phone' => '0921234567', 'delivery_fee' => 10,
            'delivered_by_user_id' => $mohamed->id,
            'items' => [['product_id' => $product->id, 'qty' => 2, 'unit_price' => 30]],
        ])->assertCreated()->assertJsonPath('delivered_by.name', 'محمد')->json('id');

        // Pending order: nothing in anyone's custody yet.
        $custody = collect(app(DashboardService::class)->custody())->keyBy('user_id');
        $this->assertEquals(0, $custody[$mohamed->id]['collected']);

        // Deliver without re-selecting: the courier assigned on the order is used.
        $this->patchJson("/api/orders/{$orderId}/status", ['status' => 'delivered'])
            ->assertOk()
            ->assertJsonPath('delivered_by.id', $mohamed->id);

        $custody = collect(app(DashboardService::class)->custody())->keyBy('user_id');
        $this->assertEquals(60, $custody[$mohamed->id]['collected']);   // goods only, not the 10 fee
        $this->assertEquals(60, $custody[$mohamed->id]['balance']);
        $this->assertEquals(-50, $custody[$eslam->id]['balance']);      // paid the 50 purchase
    }
}
