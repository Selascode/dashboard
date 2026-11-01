use std::fs;
use std::path::Path;

fn crc32(data: &[u8]) -> u32 {
    let mut crc = 0xffff_ffffu32;
    for &byte in data {
        crc ^= u32::from(byte);
        for _ in 0..8 {
            if crc & 1 != 0 {
                crc = (crc >> 1) ^ 0xedb8_8320;
            } else {
                crc >>= 1;
            }
        }
    }
    !crc
}

fn write_chunk(buf: &mut Vec<u8>, chunk_type: &[u8; 4], data: &[u8]) {
    buf.extend_from_slice(&(data.len() as u32).to_be_bytes());
    buf.extend_from_slice(chunk_type);
    buf.extend_from_slice(data);
    let mut crc_input = Vec::with_capacity(4 + data.len());
    crc_input.extend_from_slice(chunk_type);
    crc_input.extend_from_slice(data);
    buf.extend_from_slice(&crc32(&crc_input).to_be_bytes());
}

fn generate_rgba_png(width: u32, height: u32) -> Vec<u8> {
    let mut png = vec![137, 80, 78, 71, 13, 10, 26, 10];

    let mut ihdr = Vec::with_capacity(13);
    ihdr.extend_from_slice(&width.to_be_bytes());
    ihdr.extend_from_slice(&height.to_be_bytes());
    ihdr.push(8); // bit depth
    ihdr.push(6); // color type: RGBA
    ihdr.push(0); // compression
    ihdr.push(0); // filter
    ihdr.push(0); // interlace
    write_chunk(&mut png, b"IHDR", &ihdr);

    let mut raw = Vec::with_capacity((height * (1 + width * 4)) as usize);
    for _ in 0..height {
        raw.push(0);
        for _ in 0..width {
            raw.extend_from_slice(&[59, 130, 246, 255]);
        }
    }

    let len = raw.len() as u16;
    let nlen = !len;
    let mut zlib = Vec::with_capacity(2 + 5 + raw.len() + 4);
    zlib.extend_from_slice(&[0x78, 0x01]);
    zlib.push(0x01);
    zlib.extend_from_slice(&len.to_le_bytes());
    zlib.extend_from_slice(&nlen.to_le_bytes());
    zlib.extend_from_slice(&raw);

    let mut s1 = 1u32;
    let mut s2 = 0u32;
    for &b in &raw {
        s1 = (s1 + u32::from(b)) % 65521;
        s2 = (s2 + s1) % 65521;
    }
    let adler = (s2 << 16) | s1;
    zlib.extend_from_slice(&adler.to_be_bytes());

    write_chunk(&mut png, b"IDAT", &zlib);
    write_chunk(&mut png, b"IEND", &[]);
    png
}

fn ensure_default_icons() {
    let icons_dir = Path::new("icons");
    let _ = fs::create_dir_all(icons_dir);
    let icon_path = icons_dir.join("icon.png");
    if !icon_path.exists() {
        let png_bytes = generate_rgba_png(32, 32);
        let _ = fs::write(&icon_path, png_bytes);
    }
}

fn main() {
    ensure_default_icons();
    tauri_build::build();
}
