package expo.modules.thresholdpdfextractor

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaCodec
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper

class ThresholdPdfExtractorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ThresholdPdfExtractor")

    AsyncFunction("extractTextFromPdf") { filePath: String ->
      val context = appContext.reactContext
        ?: throw Exception("No React context available")

      if (!PDFBoxResourceLoader.isReady()) {
        PDFBoxResourceLoader.init(context)
      }

      val file = File(filePath)
      if (!file.exists()) {
        throw Exception("PDF file not found: $filePath")
      }

      val document = PDDocument.load(file)
      val stripper = PDFTextStripper()
      val text = stripper.getText(document)
      document.close()

      text
    }

    AsyncFunction("audioToWav") { audioPath: String ->
      // Strip file:/// (Android triple-slash), file://, or leave bare paths as-is
      val path = when {
        audioPath.startsWith("file:///") -> audioPath.removePrefix("file://")
        audioPath.startsWith("file://")  -> audioPath.removePrefix("file://")
        else -> audioPath
      }
      val inputFile = File(path)
      if (!inputFile.exists()) {
        throw Exception("Audio file not found: $path (original: $audioPath)")
      }

      val wavPath = inputFile.absolutePath.replaceAfterLast('.', "wav")
      val wavFile = File(wavPath)
      if (wavFile.exists()) {
        wavFile.delete()
      }

      val extractor = MediaExtractor()
      extractor.setDataSource(path)

      val trackIndex = selectAudioTrack(extractor)
        ?: throw Exception("No audio track found in $audioPath")

      extractor.selectTrack(trackIndex)

      val format = extractor.getTrackFormat(trackIndex)
      val mime = format.getString(MediaFormat.KEY_MIME) ?: "audio/mp4"
      val sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      val channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)

      val codec = MediaCodec.createDecoderByType(mime)
      codec.configure(format, null, null, 0)
      codec.start()

      val output = FileOutputStream(wavFile)
      val pcmData = mutableListOf<ByteArray>()
      var totalPcmSize = 0
      val bufferInfo = MediaCodec.BufferInfo()
      var sawInputEOS = false
      var sawOutputEOS = false

      while (!sawOutputEOS) {
        if (!sawInputEOS) {
          val inputIndex = codec.dequeueInputBuffer(10000)
          if (inputIndex >= 0) {
            val inputBuffer = codec.getInputBuffer(inputIndex)
            val sampleSize = extractor.readSampleData(inputBuffer!!, 0)
            if (sampleSize < 0) {
              codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              sawInputEOS = true
            } else {
              codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        var outputIndex = codec.dequeueOutputBuffer(bufferInfo, 10000)
        while (outputIndex >= 0) {
          if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
            sawOutputEOS = true
          }

          if (bufferInfo.size > 0) {
            val outBuffer = codec.getOutputBuffer(outputIndex)!!
            outBuffer.position(bufferInfo.offset)
            outBuffer.limit(bufferInfo.offset + bufferInfo.size)
            val chunk = ByteArray(bufferInfo.size)
            outBuffer.get(chunk)
            pcmData.add(chunk)
            totalPcmSize += chunk.size
          }

          codec.releaseOutputBuffer(outputIndex, false)
          outputIndex = codec.dequeueOutputBuffer(bufferInfo, 10000)
        }
      }

      codec.stop()
      codec.release()
      extractor.release()

      // Write WAV header + PCM data
      writeWavHeader(output, sampleRate, channelCount, totalPcmSize)
      for (chunk in pcmData) {
        output.write(chunk)
      }
      output.close()

      wavPath
    }
  }

  private fun selectAudioTrack(extractor: MediaExtractor): Int? {
    for (i in 0 until extractor.trackCount) {
      val format = extractor.getTrackFormat(i)
      val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
      if (mime.startsWith("audio/")) return i
    }
    return null
  }

  private fun writeWavHeader(stream: FileOutputStream, sampleRate: Int, channels: Int, dataSize: Int) {
    val header = ByteBuffer.allocate(44)
    header.order(ByteOrder.LITTLE_ENDIAN)

    header.putInt(0x46464952) // "RIFF"
    header.putInt(36 + dataSize) // file size - 8
    header.putInt(0x45564157) // "WAVE"
    header.putInt(0x20746D66) // "fmt "
    header.putInt(16) // chunk size
    header.putShort(1) // PCM format
    header.putShort(channels.toShort())
    header.putInt(sampleRate)
    header.putInt(sampleRate * channels * 2) // byte rate
    header.putShort((channels * 2).toShort()) // block align
    header.putShort(16) // bits per sample
    header.putInt(0x61746164) // "data"
    header.putInt(dataSize)

    stream.write(header.array())
  }
}
