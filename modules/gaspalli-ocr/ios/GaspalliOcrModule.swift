import ExpoModulesCore
import UIKit
import Vision

/// OCR on-device (Vision) qui renvoie chaque ligne avec sa position, en pixels de l'image redressée
/// (origine en haut à gauche), comme la version Android.
public class GaspalliOcrModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GaspalliOcr")

    AsyncFunction("recognizeLines") { (uri: String, promise: Promise) in
      let url = uri.hasPrefix("file://") ? URL(string: uri) : URL(fileURLWithPath: uri)
      guard let url = url,
            let data = try? Data(contentsOf: url),
            let image = UIImage(data: data),
            let cgImage = image.cgImage else {
        promise.reject("ERR_OCR", "Image illisible")
        return
      }
      let orientation = GaspalliOcrModule.orientation(of: image)
      let sideways: [CGImagePropertyOrientation] = [.left, .leftMirrored, .right, .rightMirrored]
      let rotated = sideways.contains(orientation)
      let width = Double(rotated ? cgImage.height : cgImage.width)
      let height = Double(rotated ? cgImage.width : cgImage.height)

      let request = VNRecognizeTextRequest { request, error in
        if let error = error {
          promise.reject("ERR_OCR", error.localizedDescription)
          return
        }
        let observations = request.results as? [VNRecognizedTextObservation] ?? []
        var lines: [[String: Any]] = []
        for observation in observations {
          guard let candidate = observation.topCandidates(1).first else { continue }
          let box = observation.boundingBox
          // Vision : coordonnées normalisées, origine en bas à gauche.
          var corners: [Double] = []
          for point in [observation.topLeft, observation.topRight, observation.bottomRight, observation.bottomLeft] {
            corners.append(Double(point.x) * width)
            corners.append((1 - Double(point.y)) * height)
          }
          lines.append([
            "text": candidate.string,
            "left": Double(box.minX) * width,
            "top": (1 - Double(box.maxY)) * height,
            "width": Double(box.width) * width,
            "height": Double(box.height) * height,
            "corners": corners,
          ])
        }
        promise.resolve(lines)
      }
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["fr-FR"]
      // Les tickets sont pleins d'abréviations : la correction automatique les « corrige » à tort.
      request.usesLanguageCorrection = false

      let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try handler.perform([request])
        } catch {
          promise.reject("ERR_OCR", error.localizedDescription)
        }
      }
    }
  }

  private static func orientation(of image: UIImage) -> CGImagePropertyOrientation {
    switch image.imageOrientation {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
  }
}
