import ExpoModulesCore
import PDFKit
import AVFoundation

public class ThresholdPdfExtractorModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ThresholdPdfExtractor")

    AsyncFunction("extractTextFromPdf") { (filePath: String) -> String in
      let url = URL(fileURLWithPath: filePath)
      guard let document = PDFDocument(url: url) else {
        throw Exception(name: "PDFError", description: "No se pudo abrir el PDF")
      }
      var totalText = ""
      for i in 0..<document.pageCount {
        if let page = document.page(at: i), let pageText = page.string {
          totalText += pageText + "\n"
        }
      }
      return totalText
    }

    AsyncFunction("renderPdfPages") { (filePath: String, dpi: Int) -> [String] in
      let url = URL(fileURLWithPath: filePath)
      guard let document = PDFDocument(url: url) else {
        throw Exception(name: "PDFError", description: "No se pudo abrir el PDF")
      }

      let cacheDir = FileManager.default.temporaryDirectory.appendingPathComponent("pdf_pages")
      if !FileManager.default.fileExists(atPath: cacheDir.path) {
        try FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
      }

      var uris: [String] = []
      let scaleFactor = CGFloat(dpi) / 72.0

      for i in 0..<document.pageCount {
        guard let page = document.page(at: i) else { continue }
        let pageSize = page.bounds(for: .mediaBox)
        let scaledSize = CGSize(width: pageSize.width * scaleFactor, height: pageSize.height * scaleFactor)
        let thumbnail = page.thumbnail(of: scaledSize, for: .mediaBox)

        guard let jpegData = thumbnail.jpegData(compressionQuality: 0.85) else { continue }
        let outURL = cacheDir.appendingPathComponent("page_\(Date().timeIntervalSince1970)_\(i).jpg")
        try jpegData.write(to: outURL)
        uris.append(outURL.path)
      }

      return uris
    }

    AsyncFunction("audioToWav") { (audioPath: String) -> String in
      let sourceURL = URL(fileURLWithPath: audioPath)
      let wavURL = sourceURL.deletingPathExtension().appendingPathExtension("wav")

      if FileManager.default.fileExists(atPath: wavURL.path) {
        try FileManager.default.removeItem(at: wavURL)
      }

      let asset = AVAsset(url: sourceURL)
      guard let reader = try? AVAssetReader(asset: asset) else {
        throw Exception(name: "AudioError", description: "No se pudo crear AVAssetReader")
      }

      guard let audioTrack = asset.tracks(withMediaType: .audio).first else {
        throw Exception(name: "AudioError", description: "No audio track found")
      }

      let outputSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsFloatKey: false,
        AVNumberOfChannelsKey: 1,
        AVSampleRateKey: 16000,
      ]

      let output = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: outputSettings)
      reader.add(output)
      reader.startReading()

      var pcmData = Data()
      while let sampleBuffer = output.copyNextSampleBuffer() {
        if let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) {
          let length = CMBlockBufferGetDataLength(blockBuffer)
          var data = Data(count: length)
          data.withUnsafeMutableBytes { ptr in
            CMBlockBufferCopyDataBytes(blockBuffer, atOffset: 0, dataLength: length, destination: ptr.baseAddress!)
          }
          pcmData.append(data)
        }
        CMSampleBufferInvalidate(sampleBuffer)
      }

      guard reader.status == .completed || reader.status == .cancelled else {
        throw Exception(name: "AudioError", description: "Audio reading failed: \(reader.error?.localizedDescription ?? "unknown")")
      }

      // Write WAV file
      let sampleRate: Int = 16000
      let channels: Int = 1
      let bitsPerSample: Int = 16
      let dataSize = pcmData.count
      let fileSize = 36 + dataSize

      var header = Data()
      // RIFF header
      header.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // "RIFF"
      var fileSizeLE = UInt32(fileSize).littleEndian
      header.append(Data(bytes: &fileSizeLE, count: 4))
      header.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // "WAVE"

      // fmt chunk
      header.append(contentsOf: [0x66, 0x6D, 0x74, 0x20]) // "fmt "
      var fmtSize = UInt32(16).littleEndian
      header.append(Data(bytes: &fmtSize, count: 4))
      var audioFormat = UInt16(1).littleEndian // PCM
      header.append(Data(bytes: &audioFormat, count: 2))
      var numChannels = UInt16(channels).littleEndian
      header.append(Data(bytes: &numChannels, count: 2))
      var sampleRateLE = UInt32(sampleRate).littleEndian
      header.append(Data(bytes: &sampleRateLE, count: 4))
      var byteRate = UInt32(sampleRate * channels * bitsPerSample / 8).littleEndian
      header.append(Data(bytes: &byteRate, count: 4))
      var blockAlign = UInt16(channels * bitsPerSample / 8).littleEndian
      header.append(Data(bytes: &blockAlign, count: 2))
      var bitsPerSampleLE = UInt16(bitsPerSample).littleEndian
      header.append(Data(bytes: &bitsPerSampleLE, count: 2))

      // data chunk
      header.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // "data"
      var dataSizeLE = UInt32(dataSize).littleEndian
      header.append(Data(bytes: &dataSizeLE, count: 4))

      try header.write(to: wavURL)
      let fileHandle = try FileHandle(forWritingTo: wavURL)
      fileHandle.seekToEndOfFile()
      fileHandle.write(pcmData)
      fileHandle.closeFile()

      return wavURL.path
    }
  }
}
