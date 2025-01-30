using FluentAssertions;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Application.Tests.Mappers;

[TestClass]
public class ProductMapperTests
{
    private readonly ProductMapper _productMapper;

    public ProductMapperTests()
    {
        _productMapper = new ProductMapper();
    }

    [TestMethod]
    public void MapToDto_ReturnsCorrectDto_WhenProductProvided()
    {
        // Arrange
        var product = new Product { Id = 1, Name = "Test Product", Price = 9.99m };

        // Act
        var result = _productMapper.MapToDto(product);

        // Assert
        result.Should().NotBeNull();
        result.Id.Should().Be(product.Id);
        result.Name.Should().Be(product.Name);
        result.Price.Should().Be(product.Price);
    }
} 