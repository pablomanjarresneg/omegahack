from pypdf import PdfReader
pdf_path = r"""C:\Users\juego\Downloads\📊 Benchmark Comparativo Global de Sistemas de Atención Ciudadana.pdf"""
reader = PdfReader(pdf_path)
print("pages", len(reader.pages))
for i, p in enumerate(reader.pages):
    text = p.extract_text() or ""
    print(f"\n--- PAGE {i+1} ---\n")
    print(text[:5000])
