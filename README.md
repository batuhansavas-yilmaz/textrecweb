# TextRec Web

Fotoğraftaki yazıyı metne çeviren, **tamamen tarayıcıda çalışan** küçük bir web uygulaması. PC'den ve telefondan aynı adresten kullanılır.

## Nasıl çalışır?

- OCR (yazı tanıma) [PaddleOCR.js](https://github.com/PaddlePaddle/PaddleOCR) ile **senin cihazında** yapılır. Fotoğraf veya PDF hiçbir sunucuya yüklenmez.
- Metin düzenleme ve `.txt` / `.docx` üretimi de tarayıcıda gerçekleşir. PDF yalnızca OCR girdisi olarak kullanılır; PDF çıktısı üretilmez.
- Uygulama **fotoğrafını veya metnini saklamaz**: çerez yok; yalnızca dil ve yüksek doğruluk tercihi localStorage'da tutulur. Tanıma sonrası fotoğraf ve metin hiçbir yere kaydedilmez. Service worker yalnızca tanıma motoru/model dosyalarını (`vendor/paddleocr/`) önbelleğe alır; böylece sonraki taramalar hızlıdır ve dosyalar yeniden indirilmez.
- Sunucu tarafı (backend) yoktur; statik dosyalardan oluşur. Bu yüzden GitHub Pages gibi ücretsiz bir yere konabilir.

## Özellikler

- Kamera ile çekme, galeriden/bilgisayardan görsel seçme, PDF seçme, sürükle-bırak, panodan yapıştırma
- Fotoğraf için isteğe bağlı kırpma ve 90° döndürme adımı (Cropper.js)
- PDF OCR: tüm sayfalar, sayfa aralığı veya belirli sayfalar (örn. `3, 4, 8` ya da `2-5`); sayfa sayfa ilerleme göstergesi
- Arayüz dili İngilizce; OCR dili sistem diline göre otomatik seçilir
- Yazı tanıma Türkçe + İngilizce + Latin alfabesi kullanan diller (PP-OCRv6 modeli); satırlar okuma sırasına göre paragraf akışına birleştirilir (kelime kelime dökmez). Yatık, ters (180°) ve aynalanmış fotoğraflar otomatik algılanıp düzeltilir.
- Sonucu düzenleme, araç menüsüyle yakınlaştırma ve tek dokunuşla kopyalama
- `.txt` ve Word (`.docx`) olarak indirme; dosya adı otomatik oluşturulur
- iOS'ta Word/Text seçilince paylaşım ekranı doğrudan açılır; paylaşım başarılı/iptal mesajı gösterilir. Diğer platformlarda indirme başarı penceresi: TXT tarayıcıda önizleme, dosya paylaşımı (destekleyen tarayıcılarda), kapat
- Mobilde yatay ekrana geçildiğinde tam ekran "Ekranı dikey çevir" uyarısı (PWA dahil)
- Tarama animasyonlu ana ekran; masaüstünde tam genişlik şerit, solda görsel ve sağda alt alta butonlar, sonuçta geniş okuma alanı; açık/koyu tema otomatik, mobil uyumlu arayüz
- Masaüstü ve mobilde varsayılan hızlı/az veri tüketen **small** modeller; isteğe bağlı **High accuracy** modu medium modelleri indirir (~110 MB ek), varsayılan kapalı
- Masaüstüne veya ana ekrana yüklenebilen PWA; kendi simgesiyle açılır

## Uygulama olarak yükleme (PWA)

- **PC (Chrome/Edge):** Adres çubuğundaki yükle simgesi.
- **Android (Chrome):** Menü → **Ana ekrana ekle**.
- **iPhone/iPad (Safari):** Paylaş → **Ana Ekrana Ekle**.

Kurulum için `manifest.webmanifest` ve `sw.js` eklidir. Service worker tanıma motoru/model dosyalarını önbellekler; fotoğraf veya metin önbelleklemez.

## Yerel çalıştırma

**En kolay yol:** `sunucu-baslat.bat` dosyasına çift tıkla. Küçük bir sunucu açılır, tarayıcı kendiliğinden `http://localhost:8000` adresini açar. Test bitince açılan siyah pencereyi kapatman yeterli.

Alternatif olarak bu klasörün içinde bir terminal aç ve şunu çalıştır:

```
python -m http.server 8000
```

Sonra tarayıcıda `http://localhost:8000` adresini aç. (Alternatif: `npx serve` ya da VS Code "Live Server".)

> Not: `index.html` dosyasına çift tıklayarak (`file://`) açmak çalışmaz — OCR motoru web worker kullandığı için küçük bir yerel sunucu gerekir.

## GitHub Pages'e yayınlama

1. GitHub'da yeni bir depo (repository) aç.
2. Bu klasördeki **tüm dosyaları** (vendor klasörü dahil) depoya yükle.
3. Depoda **Settings → Pages** bölümüne git.
4. **Source: "Deploy from a branch"** seç; **Branch: `main`, klasör: `/ (root)`** olarak kaydet.
5. 1-2 dakika sonra siten `https://KULLANICI_ADIN.github.io/DEPO_ADIN/` adresinde yayında olur.

Telefonundan aynı adresi açıp ana ekrana kısayol olarak ekleyebilirsin.

> Not: Kamera ve pano erişimi için HTTPS şarttır; GitHub Pages zaten HTTPS verir. `localhost` istisnadır (yerel test için).

## İlk açılışta ne iner?

İlk sayfa açılışı yalnızca arayüz dosyalarını (~0.5 MB) indirir; Kamera/Galeri'ye dokunmak tek başına indirme başlatmaz. OCR motoru, çalışma zamanı (ONNX Runtime Web) ve tanıma/yön modelleri fotoğraf veya PDF seçildiğinde iner. Varsayılan small modellerde toplam ~45-60 MB, High accuracy (medium) açıksa ~155-175 MB iner; yani internet hızına ek bir dış servis bağımlılığı yoktur. Word kütüphanesi ilgili format seçildiğinde, PDF.js yalnızca PDF seçildiğinde, kırpma aracı yalnızca kırpma seçildiğinde yüklenir. High accuracy ilk kez açılırken uyarı gösterilir; medium modeller indirildikten sonra bir daha sorulmaz. Dosyalar tarayıcı önbelleğine alınır, sonraki taramalar hızlıdır. Tanıma her zaman cihazda yapılır.

## Kullanılan açık kaynak bileşenler

| Bileşen | Lisans |
|---|---|
| PaddleOCR.js | Apache-2.0 |
| PP-OCRv6 modelleri (PaddleOCR) | Apache-2.0 |
| ONNX Runtime Web | MIT |
| OpenCV.js | Apache-2.0 |
| docx (Word üretimi) | MIT |
| PDF.js (PDF görüntüleme/OCR girdisi) | Apache-2.0 |
| Cropper.js (kırpma, döndürme) | MIT |
| Rubik fontu | SIL OFL 1.1 |
| Simge setleri (Font Awesome, Material Symbols) | CC BY 4.0 / Apache-2.0 |

## Gizlilik

Fotoğraf ve metin cihazdan çıkmaz, hiçbir yere gönderilmez ve hiçbir yerde saklanmaz.
