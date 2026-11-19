<?php

use Illuminate\Support\Facades\Route;

/*
| The React SPA (built into public/index.html + public/assets) handles every
| non-API path. Apache serves existing files directly; everything else lands
| here and gets index.html so React Router can take over.
*/
Route::get('/{any?}', function () {
    $index = public_path('index.html');

    if (! is_file($index)) {
        return response(
            '<h1 dir="rtl">لم يتم بناء الواجهة بعد. شغّل <code>npm run build</code> داخل مجلد frontend.</h1>',
            503
        );
    }

    return response()->file($index, [
        'Content-Type' => 'text/html; charset=UTF-8',
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ]);
})->where('any', '^(?!api/|sanctum/|up$).*$');
