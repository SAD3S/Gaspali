package app.gaspalli.ocr

import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * OCR on-device (ML Kit) qui renvoie chaque ligne avec sa position : indispensable pour un ticket
 * de caisse, où le libellé et le prix d'un article sont reconnus comme deux lignes séparées.
 */
class GaspalliOcrModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GaspalliOcr")

    AsyncFunction("recognizeLines") { uriString: String, promise: Promise ->
      try {
        val context = appContext.reactContext ?: throw IllegalStateException("Contexte Android indisponible")
        val uri = if (uriString.startsWith("content://") || uriString.startsWith("file://")) {
          Uri.parse(uriString)
        } else {
          Uri.fromFile(File(uriString))
        }
        val image = InputImage.fromFilePath(context, uri)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        recognizer.process(image)
          .addOnSuccessListener { result ->
            val lines = ArrayList<Map<String, Any>>()
            for (block in result.textBlocks) {
              for (line in block.lines) {
                val box = line.boundingBox ?: continue
                val corners = ArrayList<Double>()
                line.cornerPoints?.forEach { p ->
                  corners.add(p.x.toDouble())
                  corners.add(p.y.toDouble())
                }
                lines.add(
                  mapOf(
                    "text" to line.text,
                    "left" to box.left.toDouble(),
                    "top" to box.top.toDouble(),
                    "width" to box.width().toDouble(),
                    "height" to box.height().toDouble(),
                    "corners" to corners
                  )
                )
              }
            }
            recognizer.close()
            promise.resolve(lines)
          }
          .addOnFailureListener { e ->
            recognizer.close()
            promise.reject(CodedException("ERR_OCR", e.message ?: "Lecture impossible", e))
          }
      } catch (e: Exception) {
        promise.reject(CodedException("ERR_OCR", e.message ?: "Lecture impossible", e))
      }
    }
  }
}
