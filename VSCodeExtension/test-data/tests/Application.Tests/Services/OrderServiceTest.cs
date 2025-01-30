using Application.Services;
using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Moq;

namespace Application.Tests.Services;

[TestClass]
public class OrderServiceTest
{
    private readonly Mock<IOrderRepository> _orderRepositoryMock;
    private readonly OrderService _orderService;

    public OrderServiceTest()
    {
        _orderRepositoryMock = new Mock<IOrderRepository>();
        _orderService = new OrderService(_orderRepositoryMock.Object);
    }

    [TestMethod]
    public async Task CreateOrder_ReturnsOrder_WhenOrderIsValid()
    {
        // Arrange
        var order = new Order { Id = 1, CustomerId = 1 };
        _orderRepositoryMock.Setup(x => x.CreateAsync(order))
            .ReturnsAsync(order);

        // Act
        var result = await _orderService.CreateOrder(order);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(order.Id);
        result.CustomerId.Should().Be(order.CustomerId);
    }
} 