# نظام مخزون ومبيعات المتجر

نظام داخلي لإدارة المخزون والمبيعات لمتجر إلكتروني صغير يديره أخوان. يعمل **محلياً** على كمبيوتر ويندوز في البيت باستخدام **XAMPP**، ويُستخدم من الهواتف عبر شبكة الواي فاي المنزلية، ومن خارج البيت عبر **Tailscale**.

| الطبقة | التقنية |
|---|---|
| الخادم (API) | Laravel 13 + Sanctum (مصادقة SPA بالكوكيز) |
| الواجهة | React 19 (Vite) + Tailwind CSS 4 + React Router + TanStack Query + Recharts + React Hook Form + Zod |
| قاعدة البيانات | MySQL / MariaDB (من XAMPP) |
| خادم الويب | Apache (من XAMPP) على المنفذ 80 |
| اللغة | عربية بالكامل، اتجاه RTL، خط Cairo، العملة دينار ليبي (د.ل) |

---

## المحتويات

1. [قواعد العمل المطبّقة](#1-قواعد-العمل-المطبّقة)
2. [هيكل المشروع](#2-هيكل-المشروع)
3. [التثبيت على ويندوز خطوة بخطوة](#3-التثبيت-على-ويندوز-خطوة-بخطوة)
4. [إعداد Apache (DocumentRoot + mod_rewrite)](#4-إعداد-apache)
5. [إعداد Sanctum والجلسات للشبكة المحلية و Tailscale](#5-إعداد-sanctum-والجلسات)
6. [جدار الحماية، IP ثابت، والوصول من الهاتف](#6-جدار-الحماية-ip-ثابت-والوصول-من-الهاتف)
7. [الوصول من خارج البيت عبر Tailscale](#7-الوصول-من-خارج-البيت-عبر-tailscale)
8. [النسخ الاحتياطي اليومي](#8-النسخ-الاحتياطي-اليومي)
9. [وضع التطوير](#9-وضع-التطوير)
10. [الاختبارات](#10-الاختبارات)
11. [تحديث النظام لاحقاً](#11-تحديث-النظام-لاحقاً)
12. [حل المشاكل الشائعة](#12-حل-المشاكل-الشائعة)
13. [مرجع الـ API](#13-مرجع-الـ-api)

---

## 1. قواعد العمل المطبّقة

| القاعدة | كيف طُبّقت |
|---|---|
| المخزون لا يُعدّل يدوياً | `stock` و `avg_cost` غير قابلين للإدخال في أي نموذج أو API. المخزون الحالي = مجموع `stock_movements`، ومخزّن مؤقتاً في `products.stock` ويُحدَّث داخل نفس الـ transaction مع الحركة. الأمر `php artisan stock:audit` يتحقق من التطابق. |
| متوسط التكلفة المرجّح | عند كل شراء: `new_avg = (stock × avg + qty × unit_cost) / (stock + qty)` — في `PurchaseService::weightedAverage()` |
| تثبيت تكلفة البيع | عند حفظ صنف الطلب تُنسخ `avg_cost` الحالية إلى `order_items.unit_cost`، فلا يتغير ربح الطلبات القديمة أبداً. |
| سعر التوصيل | دخل **شخصي** لمن وصّل الطلب. يُسجَّل للمرجع فقط، ولا يدخل في الإيرادات أو الأرباح أو العهدة. البنزين ليس مصروفاً للمتجر. |
| الإيرادات | `goods_total` فقط (مجموع الكمية × سعر الوحدة) للطلبات **المسلّمة** فقط، بتاريخ التسليم. |
| رفض البيع بأكثر من المتوفر | يُرفض الطلب كاملاً بخطأ 422 ورسالة عربية تظهر في الواجهة. يُفحص مرتين: في الواجهة، ثم في الخادم تحت قفل الصف. |
| التزامن | كل عمليات الطلبات/المشتريات/التسويات داخل `DB::transaction` مع `lockForUpdate` على المنتجات (بترتيب ثابت لتجنب الـ deadlock). اختُبر بإرسال 6 طلبات متزامنة على كامل المخزون: نجح واحد ورُفض 5. |
| الإلغاء/الإرجاع | يعيد الكميات للمخزون **مرة واحدة فقط**: حقل `stock_restored` + الحالتان «ملغي» و«مرتجع» نهائيتان لا يمكن الخروج منهما. |
| تسويات المخزون | التسوية السالبة (تالف/مفقود) تُحسب خسارة بمتوسط التكلفة لحظة التسوية وتُخصم من صافي الربح. التسويات لا تُحذف؛ يُصحَّح الخطأ بتسوية معاكسة. |

### دورة حياة الطلب

| الحالة الحالية | يمكن الانتقال إلى |
|---|---|
| قيد التجهيز | خرج للتوصيل · تم التسليم · ملغي |
| خرج للتوصيل | تم التسليم · ملغي · مرتجع · قيد التجهيز |
| تم التسليم | مرتجع |
| ملغي / مرتجع | — (حالتان نهائيتان) |

- إنشاء الطلب يخصم المخزون فوراً (حركة `out`).
- تعديل أصناف الطلب مسموح فقط وهو «قيد التجهيز»، ويُحرَّك المخزون بالفرق فقط.
- «تم التسليم» يتطلب تحديد من قام بالتوصيل ويسجّل وقت التسليم.

### العهدة النقدية لكل أخ

```
العهدة = مجموع قيمة بضاعة الطلبات المسلّمة التي وصّلها
       − مشتريات دفعها − مصروفات دفعها − نقدية سلّمها للصندوق
```
القيمة السالبة تعني أن **المتجر مدين له** (تظهر باللون الأحمر في لوحة التحكم).

### صافي الربح

```
الربح الإجمالي = Σ (سعر البيع − تكلفة الوحدة المثبّتة) × الكمية   (للطلبات المسلّمة)
صافي الربح    = الربح الإجمالي − المصروفات − خسائر المخزون
```

---

## 2. هيكل المشروع

```
E-commerce-store/
├── backend/                  ← Laravel API
│   ├── app/Enums/            ← حالات الطلب، أنواع الحركات، فئات المصروفات، أسباب التسوية
│   ├── app/Models/           ← الموديلات + Concerns/HasCreator (تعبئة created_by تلقائياً)
│   ├── app/Services/         ← StockService, PurchaseService, OrderService, DashboardService
│   ├── app/Http/Controllers/Api/   ← Controllers رفيعة تستدعي الخدمات
│   ├── app/Http/Requests/    ← التحقق من المدخلات (رسائل عربية)
│   ├── app/Http/Resources/   ← شكل استجابات JSON
│   ├── database/migrations/  ← الجداول
│   ├── database/seeders/     ← المستخدمان + بيانات تجريبية لسنة كاملة
│   ├── lang/ar/              ← ترجمة رسائل التحقق للعربية
│   ├── routes/api.php        ← مسارات الـ API
│   ├── routes/web.php        ← يعيد index.html للواجهة لكل المسارات غير /api
│   ├── public/               ← نقطة دخول Apache (يُبنى فيها React أيضاً)
│   └── tests/Feature/        ← اختبارات قواعد العمل والـ API
├── frontend/                 ← React (Vite)
│   └── src/
│       ├── lib/              ← api.js (axios + CSRF)، format.js، queries.js، zod.js
│       ├── auth/             ← AuthContext + RequireAuth (حماية الصفحات)
│       ├── components/ui/    ← Table, FormField, Modal, StatCard, StatusBadge, ...
│       └── pages/            ← كل الصفحات
├── deploy/apache-vhost.conf  ← إعداد VirtualHost جاهز لـ XAMPP
└── backup.bat                ← النسخ الاحتياطي اليومي
```

---

## 3. التثبيت على ويندوز خطوة بخطوة

> المسارات أدناه تفترض أن المشروع في `C:\xampp\htdocs\E-commerce-store`. نفّذ الأوامر في **Command Prompt** أو **PowerShell**.

### 3.1 تثبيت XAMPP

1. حمّل XAMPP لويندوز من الموقع الرسمي: <https://www.apachefriends.org/download.html>
   - **مهم:** Laravel 13 يحتاج **PHP 8.3 أو أحدث**. اختر نسخة **8.4.x** (أو 8.3.x / 8.5.x). نسخة XAMPP القديمة 8.2.x **لن تعمل**.
2. ثبّته في `C:\xampp` (المسار الافتراضي).
3. افتح **XAMPP Control Panel** كمسؤول (Run as administrator) واضغط **Start** بجانب **Apache** و **MySQL**.
4. (موصى به) فعّل مربع **Svc** بجانب Apache و MySQL ليعملا كخدمات ويندوز تبدأ تلقائياً مع تشغيل الكمبيوتر حتى بدون تسجيل دخول.
5. أضف PHP إلى متغير PATH ليعمل أمر `php` في الطرفية:
   - إعدادات ويندوز ← ابحث عن «Environment Variables» ← `Path` ← أضف `C:\xampp\php`.
   - تحقق: `php -v` يجب أن يظهر 8.3 أو أحدث.
6. تأكد أن هذه الإضافات مفعّلة في `C:\xampp\php\php.ini` (احذف `;` من أول السطر إن وُجدت):
   ```ini
   extension=fileinfo
   extension=mbstring
   extension=openssl
   extension=pdo_mysql
   extension=zip
   ; للاختبارات فقط:
   extension=pdo_sqlite
   extension=sqlite3
   ```
   ثم أعد تشغيل Apache.

### 3.2 إنشاء قاعدة البيانات عبر phpMyAdmin

1. افتح <http://localhost/phpmyadmin>
2. **Databases** ← اسم القاعدة: `store_db` ← الترميز (Collation): `utf8mb4_unicode_ci` ← **Create**.

أو من الطرفية:
```bat
C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE DATABASE store_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3.3 تثبيت الأدوات

- **Composer**: حمّل `Composer-Setup.exe` من <https://getcomposer.org/download/> وعند السؤال عن PHP اختر `C:\xampp\php\php.exe`.
- **Node.js LTS** (لبناء الواجهة): من <https://nodejs.org> — يلزم فقط على الجهاز الذي تبني عليه الواجهة.
- **Git** (اختياري): لنسخ المشروع وتحديثه.

### 3.4 وضع المشروع وتثبيت Laravel

```bat
cd C:\xampp\htdocs
git clone <رابط-المستودع> E-commerce-store
```

```bat
cd C:\xampp\htdocs\E-commerce-store\backend
```

```bat
composer install --no-dev --optimize-autoloader
```

```bat
copy .env.example .env
```

```bat
php artisan key:generate
```

### 3.5 إعداد ملف `.env`

افتح `backend\.env` بمحرر نصوص وعدّل (استبدل `192.168.1.50` بـ IP جهازك، وقيم Tailscale بقيمك — انظر القسمين 6 و 7):

```env
APP_NAME="مخزون المتجر"
APP_ENV=production
APP_DEBUG=false
APP_URL=http://192.168.1.50
APP_LOCALE=ar
APP_TIMEZONE=Africa/Tripoli

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=store_db
DB_USERNAME=root
DB_PASSWORD=

SESSION_DRIVER=database
SESSION_LIFETIME=10080
SESSION_DOMAIN=null
SESSION_SECURE_COOKIE=false
SANCTUM_STATEFUL_DOMAINS=localhost,127.0.0.1,192.168.1.50,100.101.102.103,store-pc.tail1234.ts.net
```

### 3.6 إنشاء الجداول والمستخدمين

قبل التشغيل، عدّل أسماء وإيميلات الأخوين في `backend\database\seeders\UserSeeder.php` إن أردت.

**للاستخدام الفعلي** (المستخدمان فقط، بدون بيانات تجريبية):
```bat
php artisan migrate --force
```
```bat
php artisan db:seed --class=UserSeeder --force
```

**للتجربة أولاً** (المستخدمان + سنة كاملة من البيانات التجريبية: منتجات، مشتريات، ~500 طلب، مصروفات…):
```bat
php artisan migrate:fresh --seed --force
```
> لمسح البيانات التجريبية والبدء الفعلي لاحقاً: نفّذ `php artisan migrate:fresh --force` ثم `php artisan db:seed --class=UserSeeder --force`. **تحذير: يحذف كل البيانات.**

بيانات الدخول الافتراضية:

| الاسم | البريد | كلمة المرور |
|---|---|---|
| أحمد | `ahmed@store.local` | `password` |
| محمد | `mohamed@store.local` | `password` |

> **غيّر كلمتي المرور فوراً** من صفحة «الحساب» داخل النظام.

### 3.7 بناء الواجهة (React) داخل `backend/public`

```bat
cd C:\xampp\htdocs\E-commerce-store\frontend
```
```bat
npm install
```
```bat
npm run build
```

البناء يكتب `index.html` ومجلد `assets` (والأيقونات وملف manifest) داخل `backend\public` **دون** حذف ملفات Laravel (`index.php` و `.htaccess`). يعيد Laravel ملف `index.html` لكل مسار غير `/api` فيعمل React Router، وكل شيء على **نفس الأصل (origin)**.

### 3.8 تفعيل الكاش للإنتاج

```bat
cd C:\xampp\htdocs\E-commerce-store\backend
```
```bat
php artisan optimize
```
> بعد **أي** تعديل على `.env` أعد تنفيذ `php artisan optimize`، وإلا لن يُطبَّق التعديل.

---

## 4. إعداد Apache

### 4.1 تفعيل mod_rewrite و mod_headers

في `C:\xampp\apache\conf\httpd.conf` تأكد أن هذين السطرين **بدون** `#` في أولهما (مفعّلان افتراضياً في XAMPP):
```apache
LoadModule rewrite_module modules/mod_rewrite.so
LoadModule headers_module modules/mod_headers.so
```
وتأكد أن هذا السطر مفعّل أيضاً:
```apache
Include conf/extra/httpd-vhosts.conf
```

### 4.2 توجيه DocumentRoot إلى `backend/public` (VirtualHost على المنفذ 80)

افتح `C:\xampp\apache\conf\extra\httpd-vhosts.conf` وأضف في آخره محتوى الملف الجاهز [`deploy/apache-vhost.conf`](deploy/apache-vhost.conf):

```apache
<VirtualHost *:80>
    ServerName localhost
    DocumentRoot "C:/xampp/htdocs/E-commerce-store/backend/public"

    <Directory "C:/xampp/htdocs/E-commerce-store/backend/public">
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog "logs/store-error.log"
    CustomLog "logs/store-access.log" common
</VirtualHost>
```

- `AllowOverride All` ضروري ليعمل ملف `public\.htaccess` (إعادة التوجيه لـ Laravel، كاش الملفات، نوع ملف manifest).
- لأنه أول VirtualHost على `*:80` فهو يخدم كل العناوين: `localhost` و IP الشبكة و IP/اسم Tailscale.
- phpMyAdmin يبقى متاحاً على <http://localhost/phpmyadmin> من نفس الجهاز فقط (XAMPP يقيّده محلياً).

أعد تشغيل Apache من XAMPP Control Panel (Stop ثم Start)، ثم افتح <http://localhost/>.

> **إذا رفض Apache العمل على المنفذ 80:** برنامج آخر يستخدمه (Skype قديم، IIS، VMware…). اعرف من يستخدمه:
> ```bat
> netstat -ano | findstr :80
> ```

### 4.3 بديل: تعديل DocumentRoot مباشرة

بدلاً من VirtualHost يمكنك تعديل `httpd.conf`: غيّر `DocumentRoot "C:/xampp/htdocs"` و `<Directory "C:/xampp/htdocs">` إلى مسار `backend/public` مع `AllowOverride All`. طريقة VirtualHost أنظف لأنها لا تلمس إعدادات XAMPP الأساسية.

---

## 5. إعداد Sanctum والجلسات

النظام يستخدم مصادقة **Sanctum SPA** بالكوكيز (بدون توكنات): الواجهة تطلب `/sanctum/csrf-cookie` ثم `/api/auth/login`، ويُرسل المتصفح كوكي الجلسة + `X-XSRF-TOKEN` تلقائياً مع كل طلب.

### `SANCTUM_STATEFUL_DOMAINS`

قائمة العناوين (مفصولة بفواصل، بدون `http://`) المسموح لها بالمصادقة بالكوكيز. ضع فيها **كل عنوان** ستفتح منه النظام:

```env
SANCTUM_STATEFUL_DOMAINS=localhost,127.0.0.1,192.168.1.50,100.101.102.103,store-pc.tail1234.ts.net
```

| العنوان | مصدره |
|---|---|
| `localhost`, `127.0.0.1` | من نفس الكمبيوتر |
| `192.168.1.50` | IP الكمبيوتر في شبكة البيت (القسم 6) |
| `100.101.102.103` | IP الكمبيوتر في Tailscale (القسم 7) |
| `store-pc.tail1234.ts.net` | اسم MagicDNS في Tailscale |

> إذا كان المنفذ غير 80 أضفه: `192.168.1.50:8080`.
>
> **شبكة أمان إضافية:** ملف `config/sanctum.php` يضيف تلقائياً عنوان الطلب الحالي إلى القائمة (`Sanctum::currentRequestHost()`)، لأن الواجهة والـ API على نفس الأصل دائماً. لذلك لو تغيّر IP الجهاز لن ينقطع الدخول، لكن يبقى الأفضل تحديث القائمة.

### `SESSION_DOMAIN` — اتركه `null`

```env
SESSION_DOMAIN=null
```

**لماذا لا نضع فيه الـ IP أو اسم Tailscale؟** `SESSION_DOMAIN` يقبل **نطاقاً واحداً فقط**، والمتصفحات **ترفض** خاصية `Domain` في الكوكي إذا كانت عنوان IP. القيمة `null` تجعل الكوكي مرتبطاً بالعنوان الذي فتحت منه الصفحة بالضبط (host-only)، وهذا بالضبط ما نريده: يعمل الدخول من `192.168.1.50` ومن `100.x.y.z` ومن اسم MagicDNS، كلٌّ بجلسته المستقلة.

- `SESSION_SECURE_COOKIE=false` لأن الاتصال HTTP داخل الشبكة المنزلية (Tailscale يشفّر الاتصال أصلاً).
- `SESSION_LIFETIME=10080` = أسبوع، مع «تذكرني» مفعّل دائماً، حتى لا يطلب الهاتف تسجيل الدخول كل يوم.

بعد التعديل: `php artisan optimize`.

---

## 6. جدار الحماية، IP ثابت، والوصول من الهاتف

### 6.1 السماح لـ Apache عبر جدار حماية ويندوز (المنفذ 80)

1. اجعل شبكة الواي فاي **Private**: الإعدادات ← الشبكة والإنترنت ← Wi-Fi ← اسم الشبكة ← نوع ملف الشبكة: **خاصة (Private)**.
2. افتح **PowerShell كمسؤول** ونفّذ:
```powershell
New-NetFirewallRule -DisplayName "Store - Apache HTTP 80" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -Profile Private
```
بديل بـ `netsh`:
```bat
netsh advfirewall firewall add rule name="Store - Apache HTTP 80" dir=in action=allow protocol=TCP localport=80 profile=private
```
> لا تفتح منفذ MySQL (3306) — قاعدة البيانات لا تحتاج أن تكون مرئية للشبكة.

### 6.2 IP ثابت للكمبيوتر (حجز DHCP في الراوتر)

حتى لا يتغير عنوان الكمبيوتر بعد إعادة تشغيل الراوتر:

1. اعرف عنوان MAC والـ IP الحالي:
   ```bat
   ipconfig /all
   ```
   ابحث تحت محوّل الواي فاي (أو Ethernet) عن **Physical Address** (مثل `A4-B1-C2-D3-E4-F5`) و **IPv4 Address** (مثل `192.168.1.50`).
2. ادخل صفحة إعدادات الراوتر من المتصفح (غالباً <http://192.168.1.1> أو <http://192.168.0.1> — مكتوبة على ملصق الراوتر).
3. ابحث عن **DHCP Reservation** / **Address Reservation** / **Static Lease** / **IP & MAC Binding** (الاسم يختلف حسب الشركة).
4. أضف حجزاً: عنوان MAC الخاص بالكمبيوتر ← IP ثابت مثل `192.168.1.50` ← احفظ.
5. أعد تشغيل الكمبيوتر وتأكد بـ `ipconfig` أن العنوان صار `192.168.1.50`.
6. حدّث `APP_URL` و `SANCTUM_STATEFUL_DOMAINS` في `.env` ثم `php artisan optimize`.

> يُفضَّل توصيل الكمبيوتر بكابل Ethernet إن أمكن، وإيقاف وضع السكون (Sleep): الإعدادات ← النظام ← الطاقة ← «عند التوصيل بالكهرباء، ضع الجهاز في وضع السكون بعد»: **أبداً**. إذا نام الكمبيوتر لن تفتح الهواتف النظام.

### 6.3 الوصول من الهاتف وإضافته للشاشة الرئيسية

1. الهاتف متصل بنفس شبكة الواي فاي.
2. افتح المتصفح على: `http://192.168.1.50/`
3. سجّل الدخول.
4. أضفه للشاشة الرئيسية ليعمل كتطبيق (بملء الشاشة وأيقونة خاصة):
   - **آيفون (Safari):** زر المشاركة ⬆️ ← **إضافة إلى الشاشة الرئيسية** ← إضافة.
   - **أندرويد (Chrome):** القائمة ⋮ ← **إضافة إلى الشاشة الرئيسية** / **تثبيت التطبيق**.

---

## 7. الوصول من خارج البيت عبر Tailscale

Tailscale يربط أجهزتكم بشبكة خاصة مشفّرة (WireGuard) **بدون فتح أي منفذ في الراوتر** وبدون استضافة.

1. أنشئ حساباً في <https://tailscale.com> (يكفي حساب Google أو Microsoft).
2. ثبّت Tailscale على **الكمبيوتر** وسجّل الدخول بنفس الحساب. اجعله يعمل تلقائياً مع ويندوز (الإعداد الافتراضي).
3. ثبّت تطبيق Tailscale على **هاتفي الأخوين** (App Store / Google Play) وسجّلا الدخول **بنفس الحساب** (أو ادعُ الأخ الثاني إلى الـ tailnet من لوحة التحكم).
4. اعرف عنوان الكمبيوتر في Tailscale:
   ```bat
   tailscale ip -4
   ```
   (مثال: `100.101.102.103`). واسم MagicDNS يظهر في لوحة <https://login.tailscale.com/admin/machines> (مثال: `store-pc.tail1234.ts.net`).
5. أضف العنوانين إلى `SANCTUM_STATEFUL_DOMAINS` في `.env` ثم:
   ```bat
   php artisan optimize
   ```
6. من الهاتف (مع تشغيل Tailscale) افتح: `http://100.101.102.103/` أو `http://store-pc.tail1234.ts.net/`
7. أضفه للشاشة الرئيسية كاختصار ثانٍ (مثلاً «المتجر - خارج البيت»).

> جدار الحماية: Tailscale يضيف قاعدته الخاصة. إذا لم تفتح الصفحة عبر Tailscale، شغّل أمر جدار الحماية من القسم 6.1 مع `-Profile Any` بدلاً من `Private`، أو اسمح بالمنفذ 80 لنطاق `100.64.0.0/10`:
> ```powershell
> New-NetFirewallRule -DisplayName "Store - Apache via Tailscale" -Direction Inbound -Protocol TCP -LocalPort 80 -RemoteAddress 100.64.0.0/10 -Action Allow
> ```

---

## 8. النسخ الاحتياطي اليومي

الملف [`backup.bat`](backup.bat) يستخدم `C:\xampp\mysql\bin\mysqldump.exe` ليحفظ نسخة كاملة من القاعدة في `D:\backups` باسم مؤرخ مثل:
```
D:\backups\store_db_2026-11-19_23-00.sql
```
- يحتفظ بآخر **30 يوماً** ويحذف الأقدم تلقائياً.
- يسجّل النجاح/الفشل في `D:\backups\backup.log`.
- الإعدادات في أول الملف (`DB_NAME`, `DB_USER`, `DB_PASS`, `BACKUP_DIR`, `KEEP_DAYS`). إذا وضعت كلمة مرور لـ MySQL ضعها في `DB_PASS`.

### التجربة يدوياً

نقرة مزدوجة على `backup.bat`، أو:
```bat
C:\xampp\htdocs\E-commerce-store\backup.bat
```
ثم تأكد من ظهور ملف `.sql` في `D:\backups`.

### الجدولة اليومية في Task Scheduler

1. ابدأ ← اكتب **Task Scheduler** (برنامج جدولة المهام) ← افتحه.
2. من اليمين: **Create Task…** (إنشاء مهمة — وليس Basic Task).
3. تبويب **General**:
   - Name: `Store Daily Backup`
   - اختر **Run whether user is logged on or not** (تشغيل سواء سجّل المستخدم الدخول أم لا).
   - فعّل **Run with highest privileges**.
4. تبويب **Triggers** ← New ← **Daily** ← الوقت مثلاً `23:00` ← OK.
5. تبويب **Actions** ← New ← Action: **Start a program**:
   - Program/script: `C:\xampp\htdocs\E-commerce-store\backup.bat`
   - Start in: `C:\xampp\htdocs\E-commerce-store`
6. تبويب **Conditions**: ألغِ «Start the task only if the computer is on AC power» إن كان لابتوب.
7. تبويب **Settings**: فعّل **Run task as soon as possible after a scheduled start is missed** (لو كان الجهاز مطفأً وقت النسخ).
8. OK ← أدخل كلمة مرور حساب ويندوز.
9. للتجربة: كليك يمين على المهمة ← **Run**، ثم افحص `D:\backups`.

بديل بسطر واحد (PowerShell/CMD كمسؤول):
```bat
schtasks /Create /TN "Store Daily Backup" /TR "C:\xampp\htdocs\E-commerce-store\backup.bat" /SC DAILY /ST 23:00 /RL HIGHEST /F
```

> **مهم:** MySQL يجب أن يكون شغّالاً وقت النسخ (لذلك فعّل Svc في XAMPP). وانسخ مجلد `D:\backups` دورياً إلى مكان آخر (Google Drive / فلاشة) — النسخة على نفس الجهاز لا تحمي من تلف القرص.

### الاسترجاع من نسخة احتياطية

النسخة تحتوي أوامر إنشاء القاعدة، فالاسترجاع أمر واحد (**يستبدل البيانات الحالية**):
```bat
C:\xampp\mysql\bin\mysql.exe -u root < D:\backups\store_db_2026-11-19_23-00.sql
```
ثم:
```bat
cd C:\xampp\htdocs\E-commerce-store\backend
```
```bat
php artisan stock:audit
```

---

## 9. وضع التطوير

للتعديل على الكود مع إعادة التحميل الفوري:

1. في `backend\.env` اجعل `APP_ENV=local` و `APP_DEBUG=true` ثم امسح الكاش:
   ```bat
   cd C:\xampp\htdocs\E-commerce-store\backend
   ```
   ```bat
   php artisan optimize:clear
   ```
2. شغّل Laravel (طرفية أولى):
   ```bat
   php artisan serve
   ```
   يعمل على `http://127.0.0.1:8000`.
3. شغّل Vite (طرفية ثانية):
   ```bat
   cd C:\xampp\htdocs\E-commerce-store\frontend
   ```
   ```bat
   npm run dev
   ```
4. افتح <http://localhost:5173>. Vite يمرّر `/api` و `/sanctum` إلى Laravel (proxy في `vite.config.js`)، فتبقى المصادقة بالكوكيز على نفس الأصل.
   - للتجربة من الهاتف أثناء التطوير: `http://192.168.1.50:5173` (أضف `192.168.1.50:5173` إلى `SANCTUM_STATEFUL_DOMAINS` وافتح المنفذ 5173 في جدار الحماية).
   - إذا كان Laravel على عنوان آخر: `set BACKEND_URL=http://127.0.0.1:8001` قبل `npm run dev`.
5. عند الانتهاء: `npm run build` ثم أعد `.env` للإنتاج و `php artisan optimize`.

---

## 10. الاختبارات

35 اختباراً (PHPUnit) تغطي: متوسط التكلفة المرجّح، خصم المخزون، رفض البيع بأكثر من المتوفر، الإرجاع مرة واحدة فقط عند الإلغاء/الإرجاع، استبعاد سعر التوصيل من الربح، حساب العهدة، تثبيت تكلفة البيع، حذف فاتورة الشراء، تسويات المخزون، تعديل الطلب، المصادقة، الرسائل العربية، ولوحة التحكم.

```bat
cd C:\xampp\htdocs\E-commerce-store\backend
```
```bat
composer install
```
```bat
php artisan config:clear
```
```bat
php artisan test
```
```bat
php artisan optimize
```

- الاختبارات تعمل على SQLite في الذاكرة (يتطلب `extension=pdo_sqlite` في php.ini) ولا تلمس قاعدة بياناتك.
- **حماية:** إذا كان الكاش مفعّلاً (`php artisan optimize`) فإن Laravel يتجاهل إعدادات الاختبار وقد تعمل الاختبارات على القاعدة الحقيقية وتمسحها. لذلك يرفض `tests/TestCase.php` العمل أصلاً حتى تنفّذ `php artisan config:clear`.
- للاختبار على MySQL (قاعدة منفصلة `store_testing` تُنشأ أولاً):
  ```bat
  set DB_CONNECTION=mysql& set DB_DATABASE=store_testing& php artisan test
  ```

---

## 11. تحديث النظام لاحقاً

```bat
cd C:\xampp\htdocs\E-commerce-store
```
```bat
backup.bat
```
```bat
git pull
```
```bat
cd backend
```
```bat
composer install --no-dev --optimize-autoloader
```
```bat
php artisan migrate --force
```
```bat
cd ..\frontend
```
```bat
npm install
```
```bat
npm run build
```
```bat
cd ..\backend
```
```bat
php artisan optimize
```

---

## 12. حل المشاكل الشائعة

| المشكلة | الحل |
|---|---|
| صفحة «لم يتم بناء الواجهة بعد» | نفّذ `npm run build` داخل `frontend`. |
| الصفحة الرئيسية تعمل لكن `/orders` تعطي 404 من Apache | `mod_rewrite` غير مفعّل أو `AllowOverride All` ناقص (القسم 4). |
| «انتهت صلاحية الجلسة» / خطأ 419 | امسح كوكيز الموقع في المتصفح وأعد التحميل. تأكد أن `SESSION_DOMAIN=null`. |
| يسجّل الدخول ثم يرجع لصفحة الدخول (401) | العنوان المستخدم غير موجود في `SANCTUM_STATEFUL_DOMAINS` أو نسيت `php artisan optimize` بعد تعديل `.env`. |
| تعديل `.env` لا يُطبَّق | `php artisan optimize` (أو `optimize:clear` في وضع التطوير). |
| خطأ 500 | راجع `backend\storage\logs\laravel.log` و `C:\xampp\apache\logs\store-error.log`. |
| الهاتف لا يفتح `http://192.168.1.50` | الكمبيوتر نائم؟ Apache يعمل؟ قاعدة جدار الحماية (6.1)؟ الشبكة Private؟ الهاتف على نفس الواي فاي؟ |
| `composer install` يشتكي من إصدار PHP | نسخة XAMPP قديمة (8.2). ثبّت XAMPP بـ PHP 8.3 أو أحدث. |
| أشك في رقم المخزون | `php artisan stock:audit` يقارن `products.stock` بمجموع حركات المخزون. |

---

## 13. مرجع الـ API

كل المسارات تحت `/api` وتتطلب تسجيل الدخول (ما عدا `auth/login`). القوائم تدعم `?page=` و `?per_page=` وفلاتر مثل `search`, `from`, `to`, `status`, `product_id`, `user_id`.

| الطريقة | المسار | الوصف |
|---|---|---|
| POST | `/auth/login` · `/auth/logout` | دخول / خروج |
| GET · PUT | `/auth/me` · `/auth/password` | المستخدم الحالي / تغيير كلمة المرور |
| GET | `/users` | الأخوان (للقوائم المنسدلة) |
| CRUD | `/categories` | التصنيفات (الحذف ممنوع إذا فيها منتجات) |
| CRUD | `/products` | المنتجات (`?all=1` بدون ترقيم، `?low_stock=1`) — بدون `stock` و `avg_cost` |
| GET · POST · DELETE | `/purchases` | فواتير الشراء (الحذف يعكس المخزون ومتوسط التكلفة إن لم يُبع منها شيء) |
| GET · POST · PUT | `/orders` | الطلبات (التعديل فقط وهي قيد التجهيز) |
| PATCH | `/orders/{id}/status` | تغيير الحالة: `status`, `delivered_by_user_id`, `delivery_fee` |
| CRUD | `/expenses` | المصروفات |
| CRUD | `/cash-handovers` | تسليم النقدية للصندوق |
| GET · POST | `/stock-adjustments` | تسويات المخزون |
| GET | `/stock-movements` | سجل حركة المخزون (قراءة فقط) |
| GET | `/dashboard?from=&to=` | كل مؤشرات لوحة التحكم في استجابة واحدة |
| GET | `/dashboard/custody` | العهدة الحالية لكل أخ |
