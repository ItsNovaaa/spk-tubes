import pandas as pd
import numpy as np

def hitung_fucom_objektif(df, jenis_kriteria):
    """
    Menghitung bobot FUCOM secara objektif berdasarkan rata-rata normalisasi data.
    """
    print("1. Melakukan Normalisasi Data...")
    df_norm = pd.DataFrame()
    
    # Proses normalisasi sesuai dengan tipe kriteria (Benefit / Cost)
    # Hanya memproses kolom yang ada di variabel jenis_kriteria (kolom ALTERNATIF otomatis diabaikan)
    for kolom in jenis_kriteria.keys():
        x_min = df[kolom].min()
        x_max = df[kolom].max()
        
        # Penanganan error jika semua nilai dalam satu kolom sama (Xmax == Xmin)
        if x_max == x_min:
            df_norm[kolom] = 1.0 # Atau 0, tergantung asumsi jika tidak ada variasi data
            continue
            
        if jenis_kriteria[kolom] == 'Benefit':
            # Rumus Benefit: (X - Xmin) / (Xmax - Xmin)
            df_norm[kolom] = (df[kolom] - x_min) / (x_max - x_min)
        else:
            # Rumus Cost: (Xmax - X) / (Xmax - Xmin)
            df_norm[kolom] = (x_max - df[kolom]) / (x_max - x_min)
            
    print("2. Menghitung Skor Kepentingan (Rata-rata Normalisasi)...")
    skor_kepentingan = df_norm.mean()
    
    print("3. Mengurutkan Prioritas Kriteria...")
    # Urutkan dari skor terbesar ke terkecil
    skor_sorted = skor_kepentingan.sort_values(ascending=False)
    kriteria_urut = skor_sorted.index.tolist()
    
    print("\nUrutan Prioritas dan Skor:")
    for k, skor in skor_sorted.items():
        print(f"- {k}: {skor:.4f}")
        
    print("\n4. Menghitung Rasio Prioritas Komparatif (Phi)...")
    phi = []
    # Phi dihitung dengan membagi skor kriteria dengan skor kriteria di bawahnya
    for i in range(len(skor_sorted) - 1):
        nilai_phi = skor_sorted.iloc[i] / skor_sorted.iloc[i+1]
        phi.append(nilai_phi)
        print(f"Phi_{i+1} ({kriteria_urut[i]}/{kriteria_urut[i+1]}) = {nilai_phi:.4f}")

    print("\n5. Menghitung Bobot Konsisten...")
    # Sesuai jurnal, kriteria terbawah diberi nilai basis 1.0
    w_raw = [1.0] 
    
    # Hitung bobot dari bawah ke atas dengan membalik urutan phi
    phi_reversed = phi[::-1]
    for p in phi_reversed:
        w_raw.append(w_raw[-1] * p)
        
    # Kembalikan urutan bobot agar sejajar dengan urutan prioritas awal
    w_raw.reverse()
    
    # Normalisasi bobot agar totalnya menjadi 1
    total_w_raw = sum(w_raw)
    w_final = [w / total_w_raw for w in w_raw]
    
    print("\n--- HASIL AKHIR BOBOT FUCOM ---")
    hasil_bobot = {}
    for i, k in enumerate(kriteria_urut):
        hasil_bobot[k] = w_final[i]
        print(f"Bobot {k} : {w_final[i]:.4f} ({w_final[i]*100:.2f}%)")
        
    # Mengembalikan bobot dalam urutan kolom aslinya
    bobot_urut_asli = {k: hasil_bobot[k] for k in jenis_kriteria.keys()}
    return bobot_urut_asli

def hitung_vikor(df, jenis_kriteria, bobot, nama_kolom_alternatif='ALTERNATIF', v=0.10):
    """
    Menghitung perankingan menggunakan metode VIKOR.
    """
    print("\n[2] --- PROSES VIKOR ---")
    df_vikor = pd.DataFrame()
    df_vikor[nama_kolom_alternatif] = df[nama_kolom_alternatif]
    
    # Matriks untuk menyimpan nilai (Bobot * Normalisasi VIKOR)
    df_weighted_norm = pd.DataFrame()
    
    # 1. Normalisasi Matriks VIKOR
    for kolom in jenis_kriteria.keys():
        x_min = df[kolom].min()
        x_max = df[kolom].max()
        w = bobot[kolom]
        
        # Penentuan nilai ideal terbaik (X+) dan terburuk (X-)
        if jenis_kriteria[kolom] == 'Benefit':
            x_plus = x_max
            x_min_val = x_min
        else: # Cost
            x_plus = x_min
            x_min_val = x_max
            
        # Perhitungan Nilai R_ij berkalikan bobot
        jarak_ideal = abs(x_plus - x_min_val)
        
        if jarak_ideal == 0:
            df_weighted_norm[kolom] = 0.0
        else:
            # Rumus VIKOR: w * (|X+ - X_ij| / |X+ - X-|)
            df_weighted_norm[kolom] = w * (abs(x_plus - df[kolom]) / jarak_ideal)

    # 2. Menghitung Nilai S dan R
    # S = jumlah baris (sum), R = nilai maksimum dalam baris (max)
    df_vikor['S'] = df_weighted_norm.sum(axis=1)
    df_vikor['R'] = df_weighted_norm.max(axis=1)
    
    # 3. Menghitung Nilai Q (Indeks Kompromi)
    s_plus = df_vikor['S'].max()
    s_min = df_vikor['S'].min()
    r_plus = df_vikor['R'].max()
    r_min = df_vikor['R'].min()
    
    # Menghindari error division by zero jika semua alternatif bernilai sama
    def hitung_q(s, r):
        q_s = (s - s_min) / (s_plus - s_min) if (s_plus - s_min) != 0 else 0
        q_r = (r - r_min) / (r_plus - r_min) if (r_plus - r_min) != 0 else 0
        return (v * q_s) + ((1 - v) * q_r)
    
    df_vikor['Q'] = df_vikor.apply(lambda row: hitung_q(row['S'], row['R']), axis=1)
    
    # 4. Melakukan Perankingan (Berdasarkan Q terkecil)
    df_vikor['Ranking'] = df_vikor['Q'].rank(method='min', ascending=True).astype(int)
    
    # Urutkan berdasarkan ranking dari 1
    df_hasil = df_vikor.sort_values(by='Ranking')
    
    return df_hasil

# ==========================================
# BAGIAN EKSEKUSI UTAMA
# ==========================================
if __name__ == "__main__":
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="Program SPK menggunakan FUCOM dan VIKOR.")
    parser.add_argument(
        '--v', 
        type=float, 
        default=0.10, 
        help="Koefisien strategi VIKOR (v) antara 0.0 sampai 1.0 (default: 0.10)"
    )
    args = parser.parse_args()
    
    v_val = args.v
    if not (0.0 <= v_val <= 1.0):
        print("Error: Nilai v harus berada di antara 0.0 dan 1.0.")
        sys.exit(1)

    # 1. Tentukan nama file Excel-mu di sini
    # Pastikan file excel berada di folder (direktori) yang sama dengan script python ini
    nama_file_excel = 'Book1.xlsx' 
    
    try:
        print(f"Membaca data dari {nama_file_excel}...")
        df = pd.read_excel(nama_file_excel)
        
        # Konfigurasi Kriteria (Ubah sesuai dengan sifat data aslimu)
        jenis_kriteria = {
            'C1': 'Benefit', 
            'C2': 'Benefit', 
            'C3': 'Benefit', 
            'C4': 'Benefit', 
            'C5': 'Benefit', 
            'C6': 'Benefit',
            'C7': 'Benefit',
            'C8': 'Benefit',    
            'C9': 'Benefit',
            'C10': 'Benefit'
        }
        
        # 1. Dapatkan bobot dari algoritma FUCOM
        bobot_fucom = hitung_fucom_objektif(df, jenis_kriteria)
        
        # 2. Masukkan bobot tersebut ke dalam algoritma VIKOR
        print(f"Menghitung perankingan VIKOR dengan v = {v_val}...")
        hasil_ranking = hitung_vikor(df, jenis_kriteria, bobot=bobot_fucom, nama_kolom_alternatif='ALTERNATIF', v=v_val)
        
        print("\n[3] --- HASIL PERANKINGAN VIKOR ---")
        # Format angka agar lebih rapi (menampilkan 4 angka di belakang koma)
        tampilan_hasil = hasil_ranking.copy()
        tampilan_hasil['S'] = tampilan_hasil['S'].map('{:.4f}'.format)
        tampilan_hasil['R'] = tampilan_hasil['R'].map('{:.4f}'.format)
        tampilan_hasil['Q'] = tampilan_hasil['Q'].map('{:.4f}'.format)
        
        # Reset index agar tampilan tabel mulai dari 0 secara berurutan
        print(tampilan_hasil.reset_index(drop=True).to_string())
        
        # (Opsional) Simpan hasil ke Excel baru
        # hasil_ranking.to_excel('hasil_ranking_vikor.xlsx', index=False)
        # print("\nData berhasil disimpan ke 'hasil_ranking_vikor.xlsx'")
        
    except FileNotFoundError:
        print(f"Error: File '{nama_file_excel}' tidak ditemukan.")
    except Exception as e:
        print(f"Terjadi kesalahan: {e}")