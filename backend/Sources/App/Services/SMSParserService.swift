import Foundation

/// Classifies incoming SMS text into weight / food / workout / unknown.
/// Deterministic regex-based rules — testable, no ML needed.
struct SMSParserService {

    enum MealType: String {
        case breakfast, lunch, dinner, snack

        static func infer(from hour: Int) -> MealType {
            switch hour {
            case 5..<11:  return .breakfast
            case 11..<15: return .lunch
            case 15..<17: return .snack
            case 17..<22: return .dinner
            default:      return .snack
            }
        }
    }

    enum Message: Equatable {
        case weight(pounds: Double)
        case food(description: String, mealType: MealType?)
        case workout(description: String, durationMinutes: Int?, distanceMiles: Double?, exerciseName: String?)
        case unknown
    }

    // Keywords
    private static let workoutKeywords: Set<String> = [
        "ran", "run", "running", "walked", "walk", "walking", "gym", "workout",
        "lifted", "lift", "swim", "swam", "swimming", "bike", "biked", "cycled", "cycling",
        "pushups", "push-ups", "pullups", "pull-ups", "squats", "squat",
        "bench", "deadlift", "deadlifts", "yoga", "pilates",
        "hiked", "hike", "hiking", "exercise", "cardio", "rowed", "rowing"
    ]
    private static let mealKeywords: [String: MealType] = [
        "breakfast": .breakfast, "lunch": .lunch, "dinner": .dinner,
        "snack": .snack, "snacked": .snack
    ]
    private static let foodVerbs: Set<String> = ["ate", "had", "eating", "eat", "having"]

    // MARK: - Classify

    static func classify(_ rawText: String) -> Message {
        let text = rawText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return .unknown }
        let lower = text.lowercased()
        let tokens = Set(lower.components(separatedBy: CharacterSet.alphanumerics.inverted)
                                .filter { !$0.isEmpty })

        // 1. WEIGHT — most constrained, check first
        if let pounds = parseWeight(lower) {
            return .weight(pounds: pounds)
        }

        // 2. WORKOUT — explicit activity keyword
        if tokens.intersection(workoutKeywords).count > 0 ||
           lower.range(of: #"\d+\s*(?:min|minutes|mins|hrs?|hours?)"#, options: .regularExpression) != nil ||
           lower.range(of: #"\d+(?:\.\d+)?\s*(?:miles?|mi|km)"#, options: .regularExpression) != nil {
            return parseWorkout(lower)
        }

        // 3. FOOD — explicit meal/food verb, or default if contains food-ish content
        if !tokens.intersection(Set(mealKeywords.keys)).isEmpty ||
           !tokens.intersection(foodVerbs).isEmpty {
            return parseFood(lower)
        }

        // 4. Default: if it has alphabetic content (not just numbers), assume food
        if lower.rangeOfCharacter(from: .letters) != nil {
            return parseFood(lower)
        }

        return .unknown
    }

    // MARK: - Weight

    private static func parseWeight(_ text: String) -> Double? {
        // "185", "185.5", "185 lbs", "185.5 pounds", "weight 185", "wt 185"
        let pattern = #"^(?:weight\s+|wt\s+|w\s+)?(\d{2,3}(?:\.\d+)?)\s*(?:lbs?|pounds?)?\s*$"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
              let range = Range(match.range(at: 1), in: text) else {
            return nil
        }
        let n = Double(text[range]) ?? 0
        // Reasonable human weight range — avoids mis-matching "30" as weight
        return (50...500).contains(n) ? n : nil
    }

    // MARK: - Workout

    private static func parseWorkout(_ text: String) -> Message {
        let duration = firstMatch(text, pattern: #"(\d+)\s*(min|minutes|mins|hr|hrs|hour|hours)"#)
            .flatMap { matches -> Int? in
                guard matches.count >= 3, let n = Int(matches[1]) else { return nil }
                let unit = matches[2]
                return unit.hasPrefix("h") ? n * 60 : n
            }
        let distance = firstMatch(text, pattern: #"(\d+(?:\.\d+)?)\s*(miles?|mi|km)"#)
            .flatMap { matches -> Double? in
                guard matches.count >= 3, let n = Double(matches[1]) else { return nil }
                let unit = matches[2]
                return unit.hasPrefix("km") ? n * 0.621371 : n
            }
        let name = workoutKeywords.first(where: { text.contains($0) })
        return .workout(description: text, durationMinutes: duration,
                        distanceMiles: distance, exerciseName: name)
    }

    // MARK: - Food

    private static func parseFood(_ text: String) -> Message {
        var meal: MealType?
        for (keyword, type) in mealKeywords where text.contains(keyword) {
            meal = type; break
        }
        // Strip meal/verb noise to produce cleaner description
        var desc = text
        for keyword in mealKeywords.keys + Array(foodVerbs) {
            desc = desc.replacingOccurrences(of: keyword, with: "")
        }
        desc = desc
            .replacingOccurrences(of: #"\b(for|a|an|some|of|the|with|and)\b"#,
                                  with: "", options: .regularExpression)
            .replacingOccurrences(of: #"[^a-zA-Z0-9\s,]"#,
                                  with: "", options: .regularExpression)
            .split(separator: " ").joined(separator: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return .food(description: desc.isEmpty ? text : desc, mealType: meal)
    }

    // MARK: - Regex helper

    private static func firstMatch(_ text: String, pattern: String) -> [String]? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive),
              let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) else {
            return nil
        }
        return (0..<match.numberOfRanges).compactMap { i in
            Range(match.range(at: i), in: text).map { String(text[$0]) }
        }
    }
}
