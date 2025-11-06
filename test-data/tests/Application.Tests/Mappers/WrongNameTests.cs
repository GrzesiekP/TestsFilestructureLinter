// This test has wrong name. Should be UserMapperTests. For now recognizing source file front test code is not supported, so the error should be Invalid Directory Structure

using Application.Mappers;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Application.Tests.Mappers;

[TestClass]
public class WrongNameTests
{
    private readonly UserMapper _userMapper;

    public WrongNameTests()
    {
        _userMapper = new UserMapper();
    }

    [TestMethod]
    public void MapToDto_ReturnsCorrectDto_WhenUserProvided()
    {
        // Arrange
        var user = new User { Id = 1, Name = "John", Email = "john@example.com" };

        // Act
        var result = _userMapper.MapToDto(user);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(user.Id);
        result.Name.Should().Be(user.Name);
        result.Email.Should().Be(user.Email);
    }
} 