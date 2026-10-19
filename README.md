# TextRec Web

Fotoğraftaki yazıyı metne çeviren, **tamamen tarayıcıda çalışan** küçük bir web uygulaması. PC'den ve telefondan aynı adresten kullanılır.

## Nasıl çalışır?

- OCR (yazı tanıma) [PaddleOCR.js](https://github.com/PaddlePaddle/PaddleOCR) ile **senin cihazında** yapılır. Fotoğraf hiçbir sunucuya yüklenmez.
- Metin düzenleme, `.txt` / `.docx` / `.pdf` üretimi de tarayıcıda gerçekleşir.
- Uygulama **fotoğrafını veya metnini saklamaz**: çerez yok, localStorage yok; tanıma sonrası fotoğraf ve metin hiçbir yere kaydedilmez. Service worker yalnızca tanıma motoru/model dosyalarını (`vendor/paddleocr/`) önbelleğe alır; böylece sonraki taramalar hızlıdır ve dosyalar yeniden indirilmez.
- Sunucu tarafı (backend) yoktur; statik dosyalardan oluşur. Bu yüzden GitHub Pages gibi ücretsiz bir yere konabilir.

## Özellikler

- Kamera ile çekme, galeriden/bilgisayardan seçme, sürükle-bırak, panodan yapıştırma
- İsteğe bağlı kırpma ve 90° döndürme adımı (Cropper.js)
- Arayüz dili sistemine göre otomatik: Türkçe / İngilizce / Rusça (diğer dillerde İngilizce)
- Yazı tanıma Türkçe + İngilizce + Latin alfabesi kullanan diller (PP-OCRv6 modeli); satırlar okuma sırasına göre paragraf akışına birleştirilir (kelime kelime dökmez). Yatık, ters (180°) ve aynalanmış fotoğraflar otomatik algılanıp düzeltilir.
- Sonucu düzenleme, araç menüsüyle yakınlaştırma ve tek dokunuşla kopyalama
- `.txt`, Word (`.docx`) ve PDF (`.pdf`) olarak indirme; dosya adını sen belirlersin (PDF'te Türkçe karakterler gömülü Rubik fontu ile sorunsuzdur)
- İndirme sonrası başarı penceresi: PDF/TXT tarayıcıda önizleme, dosya paylaşımı (destekleyen tarayıcılarda), kapat
- Tarama animasyonlu ana ekran; masaüstünde tam genişlik şerit, solda görsel ve sağda alt alta butonlar, sonuçta geniş okuma alanı; açık/koyu tema otomatik, mobil uyumlu arayüz
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

OCR motoru, çalışma zamanı (ONNX Runtime Web) ve tanıma/yön modelleri (toplam ~175 MB) bu deponun içinden tarayıcıya iner; yani internet hızına ek bir dış servis bağımlılığı yoktur. Dosyalar tarayıcı önbelleğine alınır, sonraki taramalar hızlıdır. Tanıma her zaman cihazda yapılır.

## Kullanılan açık kaynak bileşenler

| Bileşen | Lisans |
|---|---|
| PaddleOCR.js | Apache-2.0 |
| PP-OCRv6 modelleri (PaddleOCR) | Apache-2.0 |
| ONNX Runtime Web | MIT |
| OpenCV.js | Apache-2.0 |
| docx (Word üretimi) | MIT |
| jsPDF | MIT |
| Cropper.js (kırpma, döndürme) | MIT |
| Rubik fontu | SIL OFL 1.1 |
| Simge setleri (Font Awesome, Material Symbols) | CC BY 4.0 / Apache-2.0 |

## Gizlilik

Fotoğraf ve metin cihazdan çıkmaz, hiçbir yere gönderilmez ve hiçbir yerde saklanmaz.
