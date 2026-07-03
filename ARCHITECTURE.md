# BOUTIQUE — Tam Proje Planı ve Mimari

Bu doküman BOUTIQUE (eski adı PetHub Ops) uygulamasının her katmanını, kullandığı teknolojileri, veri akışını ve güvenlik modelini açıklar.

---

## 1. Genel Bakış

BOUTIQUE, 5 hayvan mağazası şubesinin marka bazlı ürün siparişi girmesi ve tek bir admin’in tüm siparişleri görüntüleyip yönetmesi için yapılmış bir iç operasyon aracıdır.

- Şubeler marka seçer, stok bilgisine bakar ve serbest metin siparişi girer.
- Admin siparişleri filtreler, Excel’e çıkarır, siler ve günlük envanter yükler.
- Admin ayrıca şube/admin şifrelerini değiştirir.

---

## 2. Teknoloji Yığını

### 2.1 Frontend

| Teknoloji | Görevi |
|-----------|--------|
| **React 19** | UI kütüphanesi |
| **Vite 8** | Build aracı ve dev sunucusu |
| **React Router DOM 7** | Sayfa yönlendirmeleri |
| **Supabase JS Client** | Supabase Postgres ve Auth RPC çağrıları |
| **SheetJS (`xlsx`)** | Excel/CSV okuma ve yazma |
| **Plain CSS** | Tasarım sistemi (değişkenler + responsive) |

### 2.2 Backend / Veritabanı

| Teknoloji | Görevi |
|-----------|--------|
| **Supabase Postgres** | Birincil veritabanı |
| **PostgREST** | Supabase üzerinden otomatik REST/RPC API |
| **pgcrypto** | bcrypt benzeri şifre hash’leme (`crypt` + `gen_salt('bf')`) |
| **Row Level Security (RLS)** | Satır seviyesinde erişim kontrolü |
| **Supabase Edge Functions** | Kullanılmıyor (eski tasarımda vardı, yerine Postgres RPC kullanılıyor) |

### 2.3 Hosting / CI

| Hizmet | Görevi |
|--------|--------|
| **GitHub** | Kaynak kod reposu |
| **Cloudflare Pages** | Statik site hosting (önerilen) |
| **Vercel / Netlify** | Alternatif statik hosting için hazır (`vercel.json`, `_redirects` kaldırıldı) |

---

## 3. Proje Dizini ve Dosyalar

```
reqi/
├── public/
│   ├── favicon.svg
│   ├── icons.svg
│   └── logo.jpeg              # Site logosu
├── src/
│   ├── components/
│   │   ├── LoginPage.jsx      # Giriş ekranı
│   │   ├── BranchDashboard.jsx # Şube paneli
│   │   ├── AdminDashboard.jsx  # Admin paneli (3 sekme)
│   │   ├── OrderDeleteModal.jsx # Silme onay penceresi
│   │   └── Toast.jsx          # Bildirim bileşeni
│   ├── contexts/
│   │   ├── AuthContext.jsx    # Auth state ve login/me işlemleri
│   │   └── SupabaseContext.jsx # Token’lı Supabase client
│   ├── lib/
│   │   ├── constants.js       # Markalar, şubeler, roller
│   │   └── supabaseClient.js  # Client factory + config doğrulama
│   ├── App.jsx                # Routing ve koruma
│   ├── index.css              # Global stil sistemi
│   └── main.jsx               # React mount
├── supabase/
│   ├── schema.sql             # Tablolar, fonksiyonlar, RLS
│   └── seed.sql               # Varsayılan hesaplar
├── index.html                 # HTML template + başlık
├── logo.jpeg                  # Kaynak logo dosyası
├── vercel.json                # Vercel SPA rewrite ayarı
├── .env.example               # Örnek çevre değişkenleri
└── README.md                  # Kurulum rehberi
```

---

## 4. Veritabanı Şeması

### 4.1 Tablolar

#### `users`
- `id` (uuid, PK)
- `username` (text, unique)
- `display_name` (text)
- `password_hash` (text)
- `role` (text: `branch` | `admin`)
- `created_at` (timestamptz)

#### `sessions`
- `id` (uuid, PK)
- `token` (uuid, unique, default random)
- `user_id` (uuid → users)
- `created_at`, `expires_at` (timestamptz, default 24 saat)

#### `inventory`
- `id` (uuid, PK)
- `brand` (text)
- `product_name` (text)
- `qty` (integer)
- `uploaded_at` (timestamptz)

#### `orders`
- `id` (uuid, PK)
- `branch_id` (uuid → users)
- `branch_name` (text, denormalize)
- `brand` (text)
- `order_text` (text)
- `created_at` (timestamptz)
- `deleted_at` (timestamptz, soft delete)

#### `password_change_log`
- `id` (uuid, PK)
- `user_id` (uuid → users)
- `changed_by` (uuid → users)
- `changed_at` (timestamptz)

### 4.2 View

#### `user_profiles`
- `users` tablosunun `password_hash` hariç tüm kamuya açık sütunları.
- Her kullanıcı kendi satırını; admin tüm satırları görür.

---

## 5. Postgres Fonksiyonları (RPC)

| Fonksiyon | Amaç |
|-----------|------|
| `auth_user_id()` | Request header’daki `Authorization: Pethub <token>`’ı çözümler, geçerli kullanıcı ID döner. |
| `is_admin()` | Çağıran kullanıcının admin olup olmadığını kontrol eder. |
| `is_branch()` | Çağıran kullanıcının branch olup olmadığını kontrol eder. |
| `is_authenticated()` | Herhangi bir geçerli oturum var mı kontrol eder. |
| `login(p_username, p_password, p_role)` | Kullanıcı adı/şifre doğrulama, session oluşturma, token döndürme. |
| `me(p_token)` | Token’dan kullanıcı bilgisi döndürme. |
| `change_password(p_user_id, p_new_password)` | Admin şifre değişikliği (bcrypt hash + log). |
| `replace_inventory(items jsonb)` | Mevcut envanteri silip yenisini yazar (admin only). |
| `soft_delete_order(order_id uuid)` | Siparişe soft delete atar (admin only). |

---

## 6. Row Level Security (RLS) Politikaları

| Tablo | Politika | Kim | İzin |
|-------|----------|-----|------|
| `users` | — | Hiç kimse | Doğrudan okuma/yazma yok. Sadece service-side fonksiyonlar erişir. |
| `inventory` | `inventory_select_authenticated` | Giriş yapmış herkes | Select |
| `inventory` | `inventory_modify_admin` | Admin | Insert/Update/Delete |
| `orders` | `orders_select` | Şube (kendi) veya Admin (silinmemiş) | Select |
| `orders` | `orders_insert_branch_own` | Şube (kendi ID’si için) | Insert |
| `sessions` | — | Hiç kimse | Client’tan erişilmez. |
| `password_change_log` | — | Hiç kimse | Client’tan erişilmez. |

---

## 7. Kimlik Doğrulama Akışı

1. Kullanıcı rol + kullanıcı adı + şifre girer.
2. Frontend `supabase.rpc('login', {...})` çağırır.
3. Postgres `crypt()` ile şifre hash karşılaştırması yapar.
4. Başarılıysa `sessions` tablosuna yeni token satırı ekler.
5. Frontend token’ı `localStorage`’a yazar.
6. Sonraki her istekte Supabase client header olarak `Authorization: Pethub <token>` gönderir.
7. `auth_user_id()` bu header’ı okuyarak kullanıcıyı tanır.
8. Çıkışta token localStorage’dan silinir.

---

## 8. Ekranlar ve Bileşenler

### 8.1 LoginPage
- Rol toggle: Branch / Admin
- Branch seçimi dropdown veya admin kullanıcı adı inputu
- Şifre inputu
- Hata mesajı alanı

### 8.2 BranchDashboard
- Marka seçim karoları (6 marka)
- Seçili markanın envanter tablosu
- Serbest metin sipariş formu
- Şubenin kendi sipariş geçmişi tablosu

### 8.3 AdminDashboard
- **Sifarişler** sekmesi:
  - Tüm siparişler tablosu
  - Filial, brend, tarix aralığı filtreleri
  - Excel export
  - Soft delete (onay modalı)
- **Ehtiyat** sekmesi:
  - Excel/CSV envanter yükleme
  - Markaya göre gruplandırılmış envanter tablosu
- **Filiallar** sekmesi:
  - Şube ve admin şifrelerini değiştirme

### 8.4 Yardımcı Bileşenler
- `Toast`: Kısa başarı/hata bildirimleri
- `OrderDeleteModal`: Sipariş silme onayı ve özet

---

## 9. State Yönetimi

- **Auth state:** `AuthContext` (user, token, loading, login/logout)
- **Supabase client:** `SupabaseContext` (token değiştikçe yeni client oluşturur)
- **Local state:** Her dashboard kendi filtresini, form verisini ve listelerini React `useState` ile tutar.
- **Persistence:** Token ve kullanıcı `localStorage`’da saklanır.

---

## 10. Veri Akışı Senaryoları

### 10.1 Şube Siparişi Gönderme
1. BranchDashboard’da marka seçilir.
2. Sipariş metni yazılır.
3. `supabase.from('orders').insert({branch_id, branch_name, brand, order_text})`
4. RLS `orders_insert_branch_own` kontrol eder.
5. Başarılıysa toast gösterilir ve `orders` tablosu yeniden çekilir.

### 10.2 Admin Sipariş Silme
1. Admin tablodaki 🗑 ikonuna tıklar.
2. `OrderDeleteModal` açılır.
3. Onay verilirse `supabase.rpc('soft_delete_order', {order_id})` çalışır.
4. `orders.deleted_at = now()` atanır.
5. Tablo state’inden kaldırılır.

### 10.3 Envanter Yükleme
1. Admin Excel/CSV dosyası seçer.
2. SheetJS ile parse edilir.
3. Sütunlar esnek eşleştirilir (Brend/Məhsul/Say/Qalıq vs.).
4. `supabase.rpc('replace_inventory', {items})` çağrılır.
5. Fonksiyon tüm envanteri silip yenisini yazar.

### 10.4 Excel Export
1. Filtreler uygulanır.
2. Görünen satırlar `{Tarix, Filial, Brend, Sifariş mətni}` formatına çevrilir.
3. SheetJS ile `.xlsx` dosyası oluşturulur ve indirilir.

### 10.5 Şifre Değiştirme
1. Admin yeni şifreyi yazar, Saxla’ya basar.
2. `supabase.rpc('change_password', {p_user_id, p_new_password})`
3. Fonksiyon admin olduğunu doğrular.
4. `crypt(new_password, gen_salt('bf'))` ile hash üretilir.
5. `users.password_hash` güncellenir, `password_change_log` kaydı atılır.

---

## 11. Güvenlik Modeli

- **Şifreler asla plaintext saklanmaz/tasinmaz:** Hash’ler `pgcrypto` ile Postgres’te tutulur.
- **Client şifre hash görmez:** `user_profiles` view’u hash içermez.
- **Session token:** Her login’de yeni UUID token üretilir, 24 saat geçerlidir.
- **RLS:** Her veri erişimi kullanıcı rolüne göre kısıtlanır.
- **Custom auth header:** `Authorization: Pethub <token>` Supabase Auth JWT çakışmasını önler.
- **Admin yetkisi:** Şifre değiştirme, envanter yükleme, sipariş silme sadece admin içindir.
- **Env değişkenleri:** `.env` GitHub’a gitmez, sadece `.env.example` gönderilir.

---

## 12. Çevre Değişkenleri

```env
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

- Bu iki değer build zamanında Vite tarafından `import.meta.env` üzerinden okunur.
- Cloudflare Pages, Vercel, Netlify gibi platformlarda environment variables bölümünde tanımlanmalıdır.

---

## 13. Build ve Deploy

### 13.1 Build

```bash
npm install
npm run build
```

- Çıktı: `dist/` klasörü
- İçinde: `index.html`, `assets/`, `logo.jpeg`, `_redirects` (kaldırıldı), vb.

### 13.2 Cloudflare Pages Deploy (önerilen)

1. GitHub repo bağla.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variables ekle.
5. Deploy.

### 13.3 Alternatifler

- **Netlify:** `dist` sürükle-bırak veya Git bağlantısı.
- **Vercel:** `vercel.json` zaten mevcut.
- **Cloudflare direct upload:** `dist` klasörü manuel yüklenebilir.

---

## 14. Dil ve UI

- Uygulama dili: **Azerbaycan Türkçesi**
- Excel export başlıkları: `Tarix`, `Filial`, `Brend`, `Sifariş mətni`
- Tarih formatı: `az-AZ` locale
- Site adı ve logo: **BOUTIQUE**

---

## 15. V1 Kapsam Dışı (Bilerek Yapılmadı)

- Sipariş onay/red süreci
- Stoktan otomatik düşüm
- E-posta/SMS bildirim
- Şubenin kendi siparişini silmesi/düzenlemesi
- Çoklu admin hesabı
- Şube self-servis şifre sıfırlama

---

## 16. Gelecekte Eklenebilecekler

- Dashboard özet kartları (bugünkü sipariş sayısı, kritik stoklar)
- Kritik stok uyarıları
- Siparişlerde metin arama
- Geçmiş siparişi tek tıkla tekrarlama
- Silinen siparişler için “çöp kutusu”
- Envanter şablonu indirme
- Karanlık/aydınlık tema
- Otomatik timeout ile çıkış

---

## 17. Kim Ne Yapabilir?

| Rol | Yetki |
|-----|-------|
| **Branch** | Giriş yap, marka seç, envanter gör, sipariş ver, kendi geçmişini gör. |
| **Admin** | Tüm siparişleri gör/filtrele/export et/sil, envanter yükle/değiştir, tüm şifreleri değiştir. |

---

*Son güncelleme: 2026-07-04*
