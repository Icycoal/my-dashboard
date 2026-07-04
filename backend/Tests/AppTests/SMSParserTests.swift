import XCTest
@testable import App

final class SMSParserTests: XCTestCase {

    // MARK: - Weight

    func testWeightPlainNumber() {
        XCTAssertEqual(SMSParserService.classify("185"), .weight(pounds: 185))
        XCTAssertEqual(SMSParserService.classify("185.5"), .weight(pounds: 185.5))
    }

    func testWeightWithUnits() {
        XCTAssertEqual(SMSParserService.classify("185 lbs"), .weight(pounds: 185))
        XCTAssertEqual(SMSParserService.classify("185.5 pounds"), .weight(pounds: 185.5))
        XCTAssertEqual(SMSParserService.classify("weight 172"), .weight(pounds: 172))
    }

    func testNumberOutOfWeightRangeIsNotWeight() {
        // 30 by itself could be duration/age — not a human weight
        if case .weight = SMSParserService.classify("30") {
            XCTFail("30 should not classify as weight")
        }
    }

    // MARK: - Workout

    func testWorkoutRan() {
        if case .workout(_, let mins, let miles, let name) = SMSParserService.classify("ran 3 miles") {
            XCTAssertEqual(miles ?? 0, 3, accuracy: 0.01)
            XCTAssertEqual(name, "ran")
            XCTAssertNil(mins)
        } else { XCTFail("Expected workout") }
    }

    func testWorkoutDuration() {
        if case .workout(_, let mins, _, _) = SMSParserService.classify("30 min run") {
            XCTAssertEqual(mins, 30)
        } else { XCTFail("Expected workout") }
    }

    func testWorkoutHoursConvertedToMinutes() {
        if case .workout(_, let mins, _, _) = SMSParserService.classify("did 2 hours of yoga") {
            XCTAssertEqual(mins, 120)
        } else { XCTFail("Expected workout") }
    }

    func testWorkoutKm() {
        if case .workout(_, _, let miles, _) = SMSParserService.classify("biked 10 km") {
            XCTAssertNotNil(miles)
            XCTAssertEqual(miles!, 6.21, accuracy: 0.1)
        } else { XCTFail("Expected workout") }
    }

    func testWorkoutGym() {
        if case .workout = SMSParserService.classify("45 min gym session") {} else {
            XCTFail("Expected workout")
        }
    }

    func testWorkoutSquats() {
        if case .workout(_, _, _, let name) = SMSParserService.classify("5x5 squats at 225") {
            XCTAssertEqual(name, "squats")
        } else { XCTFail("Expected workout") }
    }

    // MARK: - Food

    func testFoodMealKeyword() {
        if case .food(_, let meal) = SMSParserService.classify("breakfast: 2 eggs and toast") {
            XCTAssertEqual(meal, .breakfast)
        } else { XCTFail("Expected food") }
    }

    func testFoodAteVerb() {
        if case .food = SMSParserService.classify("ate a banana") {} else {
            XCTFail("Expected food")
        }
    }

    func testFoodLunchInSentence() {
        if case .food(_, let meal) = SMSParserService.classify("had chicken and rice for lunch") {
            XCTAssertEqual(meal, .lunch)
        } else { XCTFail("Expected food") }
    }

    func testFoodDefaultForPlainDescription() {
        // No verb, no meal keyword — still should classify as food not unknown
        if case .food = SMSParserService.classify("grilled salmon") {} else {
            XCTFail("Expected food")
        }
    }

    // MARK: - Unknown

    func testUnknownEmpty() {
        XCTAssertEqual(SMSParserService.classify(""), .unknown)
        XCTAssertEqual(SMSParserService.classify("   "), .unknown)
    }

    // MARK: - Meal time inference

    func testMealTimeInference() {
        XCTAssertEqual(SMSParserService.MealType.infer(from: 7), .breakfast)
        XCTAssertEqual(SMSParserService.MealType.infer(from: 12), .lunch)
        XCTAssertEqual(SMSParserService.MealType.infer(from: 16), .snack)
        XCTAssertEqual(SMSParserService.MealType.infer(from: 19), .dinner)
        XCTAssertEqual(SMSParserService.MealType.infer(from: 23), .snack)
    }
}
