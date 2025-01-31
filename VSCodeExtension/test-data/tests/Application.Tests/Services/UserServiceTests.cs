using Application.Services;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Moq;

namespace Application.Tests.Services.WrongLocation;

[TestClass]
public class UserServiceTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly UserService _userService;

    public UserServiceTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _userService = new UserService(_userRepositoryMock.Object);
    }

    [TestMethod]
    public async Task GetUserById_ReturnsUser_WhenUserExists()
    {
        // Arrange
        var user = new User { Id = 1, Name = "John", Email = "john@example.com" };
        _userRepositoryMock.Setup(x => x.GetByIdAsync(1))
            .ReturnsAsync(user);

        // Act
        var result = await _userService.GetUserById(1);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(user.Id);
        result.Name.Should().Be(user.Name);
        result.Email.Should().Be(user.Email);
    }
} 