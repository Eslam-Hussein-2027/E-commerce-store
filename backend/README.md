# Backend (Laravel API)

See the main guide (Arabic) in [../README.md](../README.md).

Quick reference:

```bash
composer install
php artisan migrate --seed      # 2 users + one year of demo data
php artisan serve               # http://127.0.0.1:8000
php artisan config:clear && php artisan test
php artisan stock:audit         # verify products.stock == SUM(stock_movements)
```
