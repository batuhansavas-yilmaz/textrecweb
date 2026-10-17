# TextRec Web

Fotoğraftaki yazıyı metne çeviren, **tamamen tarayıcıda çalışan** küçük bir web uygulaması. PC'den ve telefondan aynı adresten kullanılır.

## Nasıl çalışır?

- OCR (yazı tanıma) [Tesseract.js](https://github.com/naptha/tesseract.js) ile **senin cihazında** yapılır. Fotoğraf hiçbir sunucuya yüklenmez.
- Metin düzenleme, `.txt` / `.docx` / `.pdf` üretimi de tarayıcıda gerçekleşir.
- Uygulama **hiçbir veri kaydetmez**: çerez yok, localStorage yok, önbellek yok. Sekmeyi kapatınca fotoğraf ve metin tamamen silinir.
- Sunucu tarafı (backend) yoktur; statik dosyalardan oluşur. Bu yüzden GitHub Pages gibi ücretsiz bir yere konabilir.

## Özellikler

- Kamera ile çekme, galeriden/bilgisayardan seçme, sürükle-bırak, panodan yapıştırma
- İsteğe bağlı kırpma adımı (Cropper.js)
- Arayüz dili sistemine göre otomatik: Türkçe / İngilizce / Rusça (diğer dillerde İngilizce)
- Yazı tanıma Türkçe + İngilizce; satırlar paragraf akışına göre birleştirilir (kelime kelime dökmez)
- Sonucu düzenleme, araç menüsüyle yakınlaştırma ve tek dokunuşla kopyalama
- `.txt`, Word (`.docx`) ve PDF (`.pdf`) olarak indirme; dosya adını sen belirlersin (PDF'te Türkçe karakterler gömülü Rubik fontu ile sorunsuzdur)
- İndirme sonrası başarı penceresi: dosyayı aç / paylaş (destekleyen tarayıcılarda) / kapat
- Tarama animasyonlu ana ekran; masaüstünde tam genişlik şerit, solda görsel ve sağda alt alta butonlar, sonuçta geniş okuma alanı; açık/koyu tema otomatik, mobil uyumlu arayüz

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

OCR motoru ve seçtiğin dilin verisi (~8–11 MB) bu deponun içinden tarayıcıya iner; yani internet hızına ek bir dış servis bağımlılığı yoktur. Tanıma her zaman cihazda yapılır.

## Kullanılan açık kaynak bileşenler

| Bileşen | Lisans |
|---|---|
| Tesseract.js ve tesseract.js-core | Apache-2.0 |
| Tesseract dil verileri (tur, eng) | Apache-2.0 |
| docx (Word üretimi) | MIT |
| jsPDF | MIT |
| Cropper.js (kırpma) | MIT |
| Rubik fontu | SIL OFL 1.1 |
| Simge setleri (Font Awesome, Material Symbols) | CC BY 4.0 / Apache-2.0 |

## Gizlilik

Fotoğraf ve metin cihazdan çıkmaz, hiçbir yere gönderilmez ve hiçbir yerde saklanmaz.
